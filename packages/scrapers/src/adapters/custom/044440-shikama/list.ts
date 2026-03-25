/**
 * 色麻町議会 — list フェーズ
 *
 * 会議録トップページから年度別ページのリンクを収集し、
 * 各年度ページから PDF ダウンロードリンクを収集する。
 *
 * HTML 構造:
 * - トップページ: /soshiki/gikai/1/kaigiroku/{ID}.html パターンのリンク
 * - 年度ページ: /material/files/group/15/*.pdf パターンのリンク
 * - 各 PDF リンクの周辺テキストから会議種別・開催日を取得
 */

import {
  BASE_ORIGIN,
  TOP_PATH,
  detectMeetingType,
  fetchPage,
  parseWarekiDate,
  toHankaku,
} from "./shared";

export interface ShikamaMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和6年 定例会12月 12月15日"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
  /** 年度ページの URL（デバッグ用） */
  yearPageUrl: string;
}

/**
 * トップページ HTML から年度別ページの URL を抽出する（テスト可能な純粋関数）。
 *
 * /soshiki/gikai/1/kaigiroku/{ID}.html パターンのリンクを収集する。
 */
export function parseYearPageUrls(html: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const linkRegex = /href="([^"]*\/soshiki\/gikai\/1\/kaigiroku\/\d+\.html)"/gi;
  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!.trim();
    const absolute = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href}`;

    if (!seen.has(absolute)) {
      seen.add(absolute);
      urls.push(absolute);
    }
  }

  return urls;
}

/**
 * 年度ページ HTML から PDF リンクとその周辺テキストを抽出する（テスト可能な純粋関数）。
 *
 * /material/files/group/15/*.pdf パターンのリンクを収集し、
 * リンクテキストまたは周辺テキストから会議種別・開催日を取得する。
 */
export function parseYearPage(
  html: string,
  yearPageUrl: string
): ShikamaMeeting[] {
  const results: ShikamaMeeting[] = [];

  // ページ内のテキスト全体から年度情報を取得（ページタイトル等）
  // h2, h3 などから会議年度のコンテキストを取得
  const pageTitleMatch = html.match(
    /<h[12][^>]*>([\s\S]*?)<\/h[12]>/i
  );
  const pageTitle = pageTitleMatch
    ? pageTitleMatch[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim()
    : "";

  // <li> や <p> 単位でブロックを処理してコンテキストを維持する
  // まず PDF リンクを含む行を抽出する
  const pdfLinkRegex =
    /<a\s[^>]*href="([^"]*\/material\/files\/group\/15\/[^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pdfLinkRegex)) {
    const href = match[1]!.trim();
    const linkText = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    const pdfUrl = href.startsWith("http")
      ? href
      : href.startsWith("//")
        ? `https:${href}`
        : `${BASE_ORIGIN}${href}`;

    // リンクテキストから開催日を抽出
    // パターン: "令和6年12月15日" や "令和元年3月10日" など
    let heldOn = parseWarekiDate(linkText);

    // リンクテキストから日付が取得できない場合、周辺 HTML を検索
    if (!heldOn) {
      // リンクの前後 500 文字でコンテキストを確認
      const matchIndex = match.index ?? 0;
      const contextStart = Math.max(0, matchIndex - 500);
      const contextEnd = Math.min(html.length, matchIndex + 500);
      const context = html.slice(contextStart, contextEnd);

      const contextText = context.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      heldOn = parseWarekiDate(contextText);
    }

    // タイトルを組み立て: pageTitle + リンクテキスト
    const title = pageTitle
      ? `${pageTitle} ${linkText}`.replace(/\s+/g, " ").trim()
      : linkText;

    results.push({
      pdfUrl,
      title,
      heldOn,
      meetingType: detectMeetingType(title + " " + linkText),
      yearPageUrl,
    });
  }

  return results;
}

/**
 * 年度ページ URL から、西暦年を推定する。
 * ページタイトルや本文テキストから「令和X年」を探す。
 */
export function extractYearFromPageHtml(html: string): number | null {
  const normalized = toHankaku(html.replace(/<[^>]+>/g, " "));

  // 「令和X年」パターン
  const reiwaMatch = normalized.match(/令和(元|\d+)年/);
  if (reiwaMatch?.[1]) {
    const n = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1], 10);
    return 2018 + n;
  }

  // 「西暦XXXX年」パターン
  const westernMatch = normalized.match(/20(\d{2})年/);
  if (westernMatch?.[1]) {
    return 2000 + parseInt(westernMatch[1], 10);
  }

  return null;
}

/**
 * 年度ページの HTML から当該ページの会議年度（西暦）を推定する。
 * ページタイトルの「令和X年議会の会議録」から取得する。
 */
export function extractYearFromPageTitle(html: string): number | null {
  const normalized = toHankaku(html);

  // h2, h3 タグからタイトルを探す
  const headingMatch = normalized.match(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/i);
  if (headingMatch) {
    const headingText = headingMatch[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
    const reiwaMatch = headingText.match(/令和(元|\d+)年/);
    if (reiwaMatch?.[1]) {
      const n = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1], 10);
      return 2018 + n;
    }
  }

  return extractYearFromPageHtml(html);
}

/**
 * トップページから年度別ページ URL を収集し、
 * 指定年の会議録 PDF 情報を取得する。
 */
export async function fetchMeetingList(
  year: number
): Promise<ShikamaMeeting[]> {
  const topUrl = `${BASE_ORIGIN}${TOP_PATH}`;
  const topHtml = await fetchPage(topUrl);
  if (!topHtml) return [];

  const yearPageUrls = parseYearPageUrls(topHtml);
  if (yearPageUrls.length === 0) return [];

  const allMeetings: ShikamaMeeting[] = [];

  for (const yearPageUrl of yearPageUrls) {
    const yearHtml = await fetchPage(yearPageUrl);
    if (!yearHtml) continue;

    // このページの年度が対象年かチェック
    const pageYear = extractYearFromPageTitle(yearHtml);
    if (pageYear !== null && pageYear !== year) continue;

    const meetings = parseYearPage(yearHtml, yearPageUrl);

    // 年度が不明なページも含めて、heldOn の西暦から年度を確認してフィルタ
    const filtered = meetings.filter((m) => {
      if (!m.heldOn) return pageYear === year;
      const heldYear = parseInt(m.heldOn.slice(0, 4), 10);
      return heldYear === year;
    });

    allMeetings.push(...filtered);
  }

  return allMeetings;
}
