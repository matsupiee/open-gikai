/**
 * 鹿島市議会 — list フェーズ
 *
 * 1. トップページ（/main/107.html）から当年度ページ URL と過去ログページ URL を取得
 * 2. 過去ログページ（/main/32950.html）から年度ページリンク一覧を取得
 * 3. 対象年度ページから PDF リンクを抽出し、会議録本文の PDF のみを収集
 *
 * 各 <li> 内のテキストから日付と会議種別を取得し、
 * <a href="...pdf"> からPDF URL を取得する。
 * 「目次」「会議結果の概要」「結果書」などは除外する。
 */

import { BASE_ORIGIN, TOP_PAGE_PATH, PAST_LOG_PAGE_PATH, detectMeetingType, fetchPage, parseHeldOn } from "./shared";

export interface KashimaPdfRecord {
  /** 会議タイトル（例: "令和6年12月定例会 11月29日（開会日）"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** 年度ページの path（例: "/main/35934.html"） */
  yearPagePath: string;
}

/**
 * 全角数字を半角数字に変換する。
 */
function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );
}

/**
 * 年度ページの HTML から年度ラベルを抽出する。
 * 例: "令和6年" → 2024
 * 例: "令和７年"（全角）→ 2025
 * 例: "平成31年・令和元年" → 2019
 * 例: "令和元年" → 2019
 */
export function parseYearFromLabel(label: string): number | null {
  // 全角数字を半角に正規化
  const normalized = toHalfWidth(label);

  // 「令和元年」
  if (normalized.includes("令和元年")) return 2019;

  // 「平成31年・令和元年」のような複合表記 → 令和元年を優先
  const reiwa = normalized.match(/令和(\d+)年/);
  if (reiwa) {
    const n = parseInt(reiwa[1]!, 10);
    return 2018 + n;
  }

  const heisei = normalized.match(/平成(\d+)年/);
  if (heisei) {
    const n = parseInt(heisei[1]!, 10);
    return 1988 + n;
  }

  return null;
}

export interface YearPageLink {
  /** 西暦年（開始年） */
  year: number;
  /** 絶対 URL */
  url: string;
}

/**
 * HTML の <a> リンクの内側テキストを取得する（span タグ等を除去）。
 */
function extractLinkText(innerHtml: string): string {
  return innerHtml
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * トップページの HTML から当年度ページ URL を抽出する。
 * ./xxxxx.html 形式のリンクを検出する。
 * リンクテキストは <span> タグで囲まれていることがあるため内側テキストを使う。
 */
export function parseTopPageLinks(html: string): YearPageLink[] {
  const links: YearPageLink[] = [];
  const seen = new Set<string>();

  // ./xxxxx.html 形式のリンクを全て抽出し、リンク内のテキストから年度を判定
  // <a href="./35933.html"><span>令和７年</span></a> のような形式に対応
  const pattern = /<a\s[^>]*href=["']\.\/(\d+)\.html["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const m of html.matchAll(pattern)) {
    const pageId = m[1]!;
    const linkText = extractLinkText(m[2]!);
    const url = `${BASE_ORIGIN}/main/${pageId}.html`;

    if (seen.has(url)) continue;

    const year = parseYearFromLabel(linkText);
    if (year === null) continue;

    seen.add(url);
    links.push({ year, url });
  }

  return links;
}

/**
 * 過去ログページ（/main/32950.html）の HTML から年度ページリンクを抽出する。
 */
export function parsePastLogLinks(html: string): YearPageLink[] {
  return parseTopPageLinks(html);
}

/**
 * 年度ページの HTML からメインコンテンツ部分を抽出する。
 * id="contents_0" から id="sub" または </main> の前までを対象とする。
 */
function extractMainContent(html: string): string {
  // id="contents_0" のある div からコンテンツを取得
  const startMark = 'id="contents_0"';
  const startIdx = html.indexOf(startMark);
  if (startIdx < 0) return html;

  // フッター側のマーカーで切り取る
  const endMarkers = ['id="sub"', 'id="footer"', '<footer'];
  let endIdx = html.length;
  for (const marker of endMarkers) {
    const idx = html.indexOf(marker, startIdx);
    if (idx >= 0 && idx < endIdx) {
      endIdx = idx;
    }
  }

  return html.substring(startIdx, endIdx);
}

/**
 * 年度ページの HTML から PDF レコードを抽出する。
 *
 * 実際のHTML構造:
 *   <div id="contents_0">
 *     <h2>令和6年12月定例会会議録</h2>
 *     <ul>
 *       <li>目次・会期日程 <a href="...pdf"><u><font>（PDF</font></u></a><a ...>185</a><a ...>KB）</a></li>
 *       <li>11月29日（開会日）<a href="...pdf"><u><font>（PDF</font></u></a>...</li>
 *     </ul>
 *   </div>
 *
 * フィルタリング:
 *   - 「目次」「会議結果」「結果書」「会期日程」は除外（会議録本文のみ対象）
 *   - PDF URL を持たない li はスキップ
 *   - 日付が解析できない li はスキップ
 */
export function parseYearPagePdfs(
  html: string,
  yearPagePath: string
): KashimaPdfRecord[] {
  const records: KashimaPdfRecord[] = [];

  // メインコンテンツのみを処理してナビゲーション要素の混入を防ぐ
  const contentHtml = extractMainContent(html);

  // 現在処理中の会議名（h2から取得）
  let currentMeetingTitle = "";

  // h2 と li 要素を位置情報付きで収集
  const elements: Array<{ type: "heading" | "li"; text: string; pos: number }> = [];

  const headingRegex = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  for (const m of contentHtml.matchAll(headingRegex)) {
    const text = m[1]!
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();
    if (text) {
      elements.push({ type: "heading", text, pos: m.index! });
    }
  }

  const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  for (const m of contentHtml.matchAll(liRegex)) {
    elements.push({ type: "li", text: m[1]!, pos: m.index! });
  }

  elements.sort((a, b) => a.pos - b.pos);

  for (const el of elements) {
    if (el.type === "heading") {
      // 会議種別を含む見出しを会議タイトルとして記録
      if (
        el.text.includes("定例会") ||
        el.text.includes("臨時会") ||
        el.text.includes("委員会")
      ) {
        currentMeetingTitle = el.text;
      }
      continue;
    }

    // li 要素の処理
    const liHtml = el.text;

    // PDF リンクを探す（複数の <a> タグに分割されていても最初の PDF href を取得）
    const pdfMatch = liHtml.match(/<a\s[^>]*href="([^"]+\.pdf)"[^>]*>/i);
    if (!pdfMatch) continue;

    const pdfPath = pdfMatch[1]!;
    const pdfUrl = pdfPath.startsWith("http") ? pdfPath : `${BASE_ORIGIN}${pdfPath}`;

    // li のプレーンテキストを取得（全 <a> タグとその内容を除去）
    const liText = liHtml
      .replace(/<a[^>]*>[\s\S]*?<\/a>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();

    // 「目次」「会議結果」「結果書」を除外
    if (
      liText.includes("目次") ||
      liText.includes("会議結果") ||
      liText.includes("結果書") ||
      liText.includes("議決の一覧") ||
      liText.includes("会期日程")
    ) {
      continue;
    }

    // 日付を抽出: "11月29日" または "20241129" パターン
    const monthDayMatch = liText.match(/(\d{1,2})月(\d{1,2})日/);
    if (!monthDayMatch) continue;

    // PDF URL からファイル名を取得して日付を解析
    const decodedPath = decodeURIComponent(pdfPath);
    const fileName = decodedPath.split("/").pop() ?? "";

    // 例: "20241129　鹿島市（開会）.pdf" → "20241129"
    // 例: "R06.9.3　鹿島市（開会）.pdf" → "R06.9.3"
    let heldOn: string | null = null;

    const yyyymmddMatch = fileName.match(/^(\d{8})/);
    if (yyyymmddMatch) {
      heldOn = parseHeldOn(yyyymmddMatch[1]!);
    }

    if (!heldOn) {
      const reiwaMatch = fileName.match(/^(R\d+\.\d{1,2}\.\d{1,2})/);
      if (reiwaMatch) {
        heldOn = parseHeldOn(reiwaMatch[1]!);
      }
    }

    // ファイル名から日付が取得できない場合はスキップ（フォールバック値禁止）
    if (!heldOn) {
      continue;
    }

    // 種別テキストを取得（例: "（開会日）" → "開会日"）
    const kindMatch = liText.match(/（([^）]+)）/);
    const kindLabel = kindMatch?.[1] ?? "";

    // 会議タイトルを構成
    const sessionLabel = `${monthDayMatch[1]}月${monthDayMatch[2]}日${kindLabel ? `（${kindLabel}）` : ""}`;
    const fullTitle = currentMeetingTitle
      ? `${currentMeetingTitle} ${sessionLabel}`
      : sessionLabel;

    records.push({
      title: fullTitle,
      heldOn,
      pdfUrl,
      meetingType: detectMeetingType(currentMeetingTitle || liText),
      yearPagePath,
    });
  }

  return records;
}

/**
 * 対象年の全 PDF レコードを収集する。
 *
 * 戦略:
 * 1. トップページから当年度ページ URL を収集
 * 2. 過去ログページから全年度ページ URL を収集
 * 3. 対象年度のページから PDF レコードを抽出
 */
export async function fetchPdfList(
  _baseUrl: string,
  year: number
): Promise<KashimaPdfRecord[]> {
  // Step 1: トップページから当年度ページを取得
  const topUrl = `${BASE_ORIGIN}${TOP_PAGE_PATH}`;
  const topHtml = await fetchPage(topUrl);

  const topLinks: YearPageLink[] = topHtml ? parseTopPageLinks(topHtml) : [];

  // Step 2: 過去ログページから全年度ページを取得
  const pastLogUrl = `${BASE_ORIGIN}${PAST_LOG_PAGE_PATH}`;
  const pastLogHtml = await fetchPage(pastLogUrl);
  const pastLinks: YearPageLink[] = pastLogHtml ? parsePastLogLinks(pastLogHtml) : [];

  // 全年度ページを統合（重複排除）
  const allLinks = new Map<string, YearPageLink>();
  for (const link of [...topLinks, ...pastLinks]) {
    if (!allLinks.has(link.url)) {
      allLinks.set(link.url, link);
    }
  }

  // 対象年のページを特定
  const targetLink = [...allLinks.values()].find((l) => l.year === year);
  if (!targetLink) return [];

  // Step 3: 対象年度ページから PDF レコードを抽出
  const yearHtml = await fetchPage(targetLink.url);
  if (!yearHtml) return [];

  const yearPagePath = new URL(targetLink.url).pathname;
  return parseYearPagePdfs(yearHtml, yearPagePath);
}
