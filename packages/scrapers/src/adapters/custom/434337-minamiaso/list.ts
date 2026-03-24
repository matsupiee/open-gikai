/**
 * 南阿蘇村議会 — list フェーズ
 *
 * 取得フロー:
 * 1. 会議録メイン一覧ページ（list00576.html）から各年度の一覧ページ URL を収集
 * 2. 各年度一覧ページから kiji{番号}/index.html 形式の詳細ページ URL と会議タイトルを収集
 * 3. 指定年に合致する会議のみ詳細ページを取得して PDF URL を収集
 *
 * ページ構造（メイン一覧ページ）:
 *   - 各年度の一覧ページへのリンク（protocol-relative URL）
 *   - e.g., //www.vill.minamiaso.lg.jp/gikai/list00579.html
 *
 * ページ構造（年度別一覧ページ）:
 *   - 会議名リンク（絶対 URL）→ kiji{番号}/index.html
 *   - e.g., "令和6年第4回（12月）定例会会議録"
 *
 * ページ構造（詳細ページ）:
 *   - PDF ファイルリンク → kiji{番号}/{ランダムハッシュ}.pdf
 */

import { MAIN_LIST_URL, BASE_ORIGIN, fetchPage, toAbsoluteUrl } from "./shared";

export interface MinamiAsoMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（年度別一覧ページのリンクテキスト） */
  title: string;
  /** 開催日 YYYY-MM-DD（会議名からパース、解析できない場合は null） */
  heldOn: string | null;
  /** 詳細ページの URL */
  detailUrl: string;
  /** kiji 番号（externalId 生成用） */
  kijiId: string;
}

/**
 * 会議名テキストから YYYY-MM-DD を抽出する。
 * e.g., "令和6年第4回（12月）定例会会議録" → 年=2024, 月=12
 * e.g., "令和6年第1回（1月）臨時会議録" → 年=2024, 月=1
 * 解析できない場合は null を返す。
 */
export function parseTitleDate(title: string): string | null {
  const match = title.match(/(令和|平成)(元|\d+)年.*?（(\d+)月）/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-01`;
}

/**
 * メイン一覧ページ HTML から各年度の一覧ページ URL を抽出する。
 *
 * サイドメニューやメインコンテンツに "list{XXXXX}.html" 形式のリンクが含まれる。
 * protocol-relative URL（//www.vill.minamiaso.lg.jp/...）を使用している。
 * ただし MAIN_LIST_URL 自体（list00576）は除外する。
 */
export function parseMainListPage(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const linkPattern = /href="([^"]*list\d+\.html)"/gi;
  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    // list00576 はメイン一覧自身なのでスキップ
    if (href.includes("list00576")) continue;

    const absUrl = toAbsoluteUrl(href);
    if (!seen.has(absUrl)) {
      seen.add(absUrl);
      urls.push(absUrl);
    }
  }

  return urls;
}

/**
 * 年度別一覧ページの HTML から詳細ページ URL と会議タイトルを抽出する。
 *
 * kiji{番号}/index.html 形式のリンクを全件収集する。
 * リンクテキストに会議名（例: "令和6年第4回（12月）定例会会議録"）が含まれる。
 */
export function parseYearListPage(
  html: string
): { detailUrl: string; kijiId: string; title: string }[] {
  const results: { detailUrl: string; kijiId: string; title: string }[] = [];
  const seen = new Set<string>();

  // kiji リンクとそのリンクテキストを抽出
  const linkPattern =
    /<a[^>]+href="([^"]*kiji(\d+)\/index\.html)"[^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const kijiId = match[2]!;
    const rawTitle = match[3]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const absUrl = toAbsoluteUrl(href);

    if (!seen.has(absUrl)) {
      seen.add(absUrl);
      results.push({ detailUrl: absUrl, kijiId, title: rawTitle });
    }
  }

  return results;
}

/**
 * 詳細ページ HTML から PDF URL を抽出する。
 *
 * ページ内の .pdf リンクを収集する。
 */
export function parseDetailPage(
  html: string,
  detailUrl: string
): { pdfUrl: string } | null {
  // PDF リンクを抽出
  const pdfMatch = html.match(/href="([^"]+\.pdf)"/i);
  if (!pdfMatch) return null;

  const pdfHref = pdfMatch[1]!;
  let pdfUrl: string;
  if (pdfHref.startsWith("http")) {
    pdfUrl = pdfHref;
  } else if (pdfHref.startsWith("//")) {
    pdfUrl = `https:${pdfHref}`;
  } else if (pdfHref.startsWith("/")) {
    pdfUrl = `${BASE_ORIGIN}${pdfHref}`;
  } else {
    // 詳細ページと同じディレクトリ
    const base = detailUrl.replace(/\/index\.html$/, "/");
    pdfUrl = `${base}${pdfHref}`;
  }

  return { pdfUrl };
}

/**
 * 指定年の全会議録 PDF リンクを取得する。
 *
 * 1. メイン一覧から全年度の一覧ページ URL を収集
 * 2. 各年度一覧ページからリンクテキストと詳細 URL を収集
 * 3. リンクテキストに指定年（和暦）が含まれるものに絞り込む
 * 4. 絞り込んだ詳細ページから PDF URL を取得
 */
export async function fetchMeetingList(year: number): Promise<MinamiAsoMeeting[]> {
  const html = await fetchPage(MAIN_LIST_URL);
  if (!html) return [];

  const yearListUrls = parseMainListPage(html);
  if (yearListUrls.length === 0) return [];

  // 指定年（西暦）に対応する和暦を求める
  const reiwaYear = year - 2018;
  const heiseiYear = year - 1988;

  // 和暦で指定年に相当するタイトル文字列
  const targetYearStrings: string[] = [];
  if (reiwaYear >= 1) {
    targetYearStrings.push(
      reiwaYear === 1 ? "令和元年" : `令和${reiwaYear}年`
    );
  }
  if (heiseiYear >= 1) {
    targetYearStrings.push(
      heiseiYear === 1 ? "平成元年" : `平成${heiseiYear}年`
    );
  }

  // 各年度一覧ページからリンク情報を収集し、指定年に絞り込む
  const targetRefs: { detailUrl: string; kijiId: string; title: string }[] = [];

  for (const yearPageUrl of yearListUrls) {
    const yearHtml = await fetchPage(yearPageUrl);
    if (!yearHtml) continue;

    const refs = parseYearListPage(yearHtml);
    for (const ref of refs) {
      const isTargetYear = targetYearStrings.some((s) => ref.title.includes(s));
      if (isTargetYear) {
        targetRefs.push(ref);
      }
    }
  }

  // 詳細ページを取得して PDF URL を収集
  const meetings: MinamiAsoMeeting[] = [];

  for (const { detailUrl, kijiId, title } of targetRefs) {
    const detailHtml = await fetchPage(detailUrl);
    if (!detailHtml) continue;

    const result = parseDetailPage(detailHtml, detailUrl);
    if (!result) continue;

    const heldOn = parseTitleDate(title);

    meetings.push({
      pdfUrl: result.pdfUrl,
      title,
      heldOn,
      detailUrl,
      kijiId,
    });
  }

  return meetings;
}
