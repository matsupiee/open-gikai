/**
 * みなかみ町議会 — list フェーズ
 *
 * 2段階で PDF リンクを収集する:
 * 1. トップページから年度別ページへのリンクを収集（または既知の URL マッピングを使用）
 * 2. 年度別ページから議事録 PDF リンクとメタ情報を抽出
 *
 * PDF 種別の判別:
 *   -m.pdf  → 目次（スキップ）
 *   -k.pdf  → 審議結果（スキップ）
 *   -s.pdf  → 参考資料（スキップ）
 *   -1.pdf, -2.pdf, -3.pdf  → 議事録本文（対象）
 *   -g-1.pdf 等（H17〜H18 形式）→ 議事録本文（対象）
 */

import {
  BASE_ORIGIN,
  BASE_PATH,
  YEAR_PAGE_URLS,
  YEAR_PAGE_URL_H31,
  detectMeetingType,
  eraToWestern,
  fetchPage,
  normalizeFullWidth,
} from "./shared";

export interface MinakamiMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string | null;
}

/**
 * トップページの HTML から年度別ページへのリンクを抽出する。
 * リンクパターン: <a href="{filename}.html"> または <a href="{filename}.html">
 */
export function parseTopPage(html: string): { year: number; pageUrl: string }[] {
  const results: { year: number; pageUrl: string }[] = [];

  // すべての <a href="...html"> リンクを走査して年号テキストと照合する
  const linkRegex = /<a[^>]+href="([^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!.trim();
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();
    const text = normalizeFullWidth(rawText);

    // 年号テキストから西暦を判定
    const eraMatch = text.match(/(?:令和|平成|昭和)(元|\d+)年/);
    if (!eraMatch) continue;

    const era = text.match(/令和|平成|昭和/)?.[0];
    if (!era) continue;

    const westernYear = eraToWestern(era, eraMatch[1]!);

    // 相対 URL を絶対 URL に変換
    let pageUrl: string;
    if (href.startsWith("http")) {
      pageUrl = href;
    } else if (href.startsWith("/")) {
      pageUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pageUrl = `${BASE_ORIGIN}${BASE_PATH}/${href}`;
    }

    if (!results.some((r) => r.pageUrl === pageUrl)) {
      results.push({ year: westernYear, pageUrl });
    }
  }

  return results;
}

/**
 * PDF ファイル名が議事録本文であるかを判定する。
 *
 * 対象: 数字のみ (-1.pdf, -2.pdf) または -g-{N}.pdf (H17-H18形式)
 * 除外: -m.pdf (目次), -k.pdf (審議結果), -s.pdf (参考資料)
 */
export function isMinutePdf(filename: string): boolean {
  // 末尾が -m.pdf / -k.pdf / -s.pdf は除外
  if (/-[mks]\.pdf$/i.test(filename)) return false;
  // 末尾が数字の場合は対象 (例: -1.pdf, -2.pdf)
  if (/-\d+\.pdf$/i.test(filename)) return true;
  // g-N 形式 (例: -g-1.pdf) は対象
  if (/-g-\d+\.pdf$/i.test(filename)) return true;
  // それ以外は除外
  return false;
}

/**
 * リンクテキストから開催日（YYYY-MM-DD）を推定する。
 *
 * パターン例:
 *   "令和6年第2回（3月）定例会" → "2024-03-01"
 *   "令和6年第1回（2月）臨時会" → "2024-02-01"
 *   "平成17年第3回（12月）定例会" → "2005-12-01"
 *
 * 解析できない場合は null を返す（フォールバック値禁止）。
 */
export function parseLinkDate(text: string): string | null {
  const normalized = normalizeFullWidth(text);

  // パターン: 令和/平成/昭和 + 年号 + 月
  const match = normalized.match(
    /(令和|平成|昭和)(元|\d+)年.*?(?:[（(](\d+)月[）)])/,
  );
  if (match) {
    const era = match[1]!;
    const eraYearStr = match[2]!;
    const month = parseInt(match[3]!, 10);
    const westernYear = eraToWestern(era, eraYearStr);
    return `${westernYear}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * 年度別ページの HTML から PDF リンクと会議メタ情報を抽出する。
 *
 * みなかみ町の実際の HTML 構造:
 *   【みなかみ町令和6年第1回（2月）臨時会】<br>
 *   <a href="files/R06-2-m.pdf">・</a><a href="files/R06-2-m.pdf">目次</a>
 *   <a href="files/R06-2-1.pdf">・</a><a href="files/R06-2-1.pdf">議事録-1</a>　...<br>
 *
 * 特徴:
 * - 会議名は <br> で区切られたテキストノード（【...】形式）
 * - 同じ会議の PDF リンクが1行内に並んでいる（複数の <a> タグ）
 * - 議事録本文の PDF のみを対象とし、目次・審議結果・参考資料はスキップ
 */
export function parseYearPage(html: string): MinakamiMeeting[] {
  const results: MinakamiMeeting[] = [];

  // 現在処理中の会議名（PDF リンクの直前のテキストブロックから抽出）
  let currentTitle = "";
  let currentHeldOn: string | null = null;

  // <br> タグで行に分割する
  const lines = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/td>/gi, "\n")
    .split("\n");

  const pdfLinkRegex = /<a[^>]+href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 行内の全 PDF リンクを収集
    const pdfMatches = [...line.matchAll(pdfLinkRegex)];
    if (pdfMatches.length > 0) {
      // 同一 href の重複を除去しながら処理
      const seenHrefs = new Set<string>();
      for (const pdfMatch of pdfMatches) {
        const href = pdfMatch[1]!;
        if (seenHrefs.has(href)) continue;
        seenHrefs.add(href);

        // 議事録本文のみ対象
        const filename = href.split("/").pop() ?? "";
        if (!isMinutePdf(filename)) continue;

        // PDF の完全 URL を構築
        let pdfUrl: string;
        if (href.startsWith("http")) {
          pdfUrl = href;
        } else if (href.startsWith("/")) {
          pdfUrl = `${BASE_ORIGIN}${href}`;
        } else {
          pdfUrl = `${BASE_ORIGIN}${BASE_PATH}/${href}`;
        }

        results.push({
          pdfUrl,
          title: currentTitle || "みなかみ町議会会議録",
          heldOn: currentHeldOn,
        });
      }
      continue;
    }

    // テキスト行から会議名を抽出（HTML タグを除去）
    const plainText = line
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();

    if (!plainText) continue;

    // 会議名のパターン: 【...】 または 和暦を含むテキスト
    const bracketMatch = plainText.match(/【(.+?)】/);
    if (bracketMatch) {
      currentTitle = bracketMatch[1]!.trim();
      currentHeldOn = parseLinkDate(currentTitle);
    } else if (/(?:令和|平成|昭和)(元|\d+)年/.test(plainText)) {
      // ブラケットなしの和暦テキスト（H17 形式等）
      const dateCandidate = parseLinkDate(plainText);
      if (dateCandidate) {
        currentTitle = plainText.replace(/\s+/g, " ").trim();
        currentHeldOn = dateCandidate;
      }
    }
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<MinakamiMeeting[]> {
  // Step 1: トップページから年度別ページの URL を取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  // 既知の URL マッピングから対象年度を特定
  const yearPageFile = YEAR_PAGE_URLS[year];
  let yearPageUrl: string | null = null;

  if (yearPageFile) {
    yearPageUrl = `${BASE_ORIGIN}${BASE_PATH}/${yearPageFile}`;
  } else {
    // トップページから動的に収集（フォールバック）
    const yearPages = parseTopPage(topHtml);
    const targetPage = yearPages.find((p) => p.year === year);
    if (targetPage) {
      yearPageUrl = targetPage.pageUrl;
    }
  }

  // 2019年は令和元年と平成31年の2ページがある
  const extraPageFile = year === 2019 ? YEAR_PAGE_URL_H31 : undefined;

  if (!yearPageUrl && !extraPageFile) return [];

  const allMeetings: MinakamiMeeting[] = [];

  // メインページを処理
  if (yearPageUrl) {
    const yearHtml = await fetchPage(yearPageUrl);
    if (yearHtml) {
      allMeetings.push(...parseYearPage(yearHtml));
    }
  }

  // 2019年: 平成31年のページも処理
  if (extraPageFile) {
    const extraUrl = `${BASE_ORIGIN}${BASE_PATH}/${extraPageFile}`;
    const extraHtml = await fetchPage(extraUrl);
    if (extraHtml) {
      allMeetings.push(...parseYearPage(extraHtml));
    }
  }

  return allMeetings;
}

/** detectMeetingType を再エクスポート */
export { detectMeetingType };
