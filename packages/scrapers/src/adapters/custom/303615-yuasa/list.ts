/**
 * 湯浅町議会 会議録 -- list フェーズ
 *
 * 3段階クロール:
 * 1. 議会トップページ (/site/gikai/) から年度別一覧ページへのリンクを収集
 *    - 定例会: list47-{ID}.html
 *    - 臨時会: list48-{ID}.html
 * 2. 年度別一覧ページから個別会議詳細ページへのリンクを抽出
 * 3. 会議詳細ページから PDF リンクを全件抽出
 *
 * トップページリンク構造:
 *   <a href="/site/gikai/list47-357.html">令和7年度</a>
 *
 * 年度別一覧のリンク構造:
 *   <a href="/site/gikai/10474.html">第4回定例会（令和7年12月）</a>
 *
 * 会議詳細の PDF リンク構造:
 *   <a href="/uploaded/attachment/9923.pdf">一般質問</a>
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  fetchPage,
  meetingTypeFromListUrl,
  parseDateFromTitle,
} from "./shared";

export interface YuasaMeeting {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "令和7年12月定例会（第4回）"） */
  title: string;
  /** 開催日 YYYY-MM-DD または null（解析不可の場合） */
  heldOn: string | null;
  /** 会議種別（plenary / extraordinary） */
  meetingType: string;
  /** 会議詳細ページの URL */
  detailPageUrl: string;
}

/**
 * 議会トップページ HTML から年度別一覧ページへのリンクを抽出する。
 * list47-{ID}.html（定例会）と list48-{ID}.html（臨時会）の両方を対象。
 */
export function parseTopPage(
  html: string,
  year: number
): { url: string; meetingType: string }[] {
  const results: { url: string; meetingType: string }[] = [];
  const seen = new Set<string>();

  // list47-{ID}.html または list48-{ID}.html へのリンクを抽出
  const linkPattern = /<a\s[^>]*href="([^"]*\/site\/gikai\/list(?:47|48)-\d+\.html)"[^>]*>([^<]*)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (seen.has(url)) continue;

    // リンクテキストに年度情報があれば年度フィルタを適用
    // 「令和7年度」「令和7年」「2025年度」等
    const eraYearMatch = linkText.match(/(令和|平成|昭和)(\d+|元)年/);
    if (eraYearMatch) {
      const eraName = eraYearMatch[1]!;
      const eraYearStr = eraYearMatch[2]!;
      const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
      let targetYear: number;
      if (eraName === "令和") targetYear = 2018 + eraYear;
      else if (eraName === "平成") targetYear = 1988 + eraYear;
      else targetYear = 1925 + eraYear;

      // 年度は西暦年と同じか1年ずれる（例: 令和7年度 = 2025年4月〜2026年3月）
      // year が 2025 なら令和7年（2025）の一覧を対象とする
      if (targetYear !== year) continue;
    }

    seen.add(url);
    results.push({
      url,
      meetingType: meetingTypeFromListUrl(url),
    });
  }

  return results;
}

/**
 * トップページ HTML から年度フィルタなしで全年度の一覧リンクを抽出する。
 * 年度情報が取れなかったリンクも含む。
 */
export function parseTopPageAllLinks(
  html: string
): { url: string; meetingType: string; year: number | null }[] {
  const results: { url: string; meetingType: string; year: number | null }[] = [];
  const seen = new Set<string>();

  const linkPattern = /<a\s[^>]*href="([^"]*\/site\/gikai\/list(?:47|48)-\d+\.html)"[^>]*>([^<]*)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (seen.has(url)) continue;
    seen.add(url);

    let year: number | null = null;
    const eraYearMatch = linkText.match(/(令和|平成|昭和)(\d+|元)年/);
    if (eraYearMatch) {
      const eraName = eraYearMatch[1]!;
      const eraYearStr = eraYearMatch[2]!;
      const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
      if (eraName === "令和") year = 2018 + eraYear;
      else if (eraName === "平成") year = 1988 + eraYear;
      else year = 1925 + eraYear;
    }

    results.push({
      url,
      meetingType: meetingTypeFromListUrl(url),
      year,
    });
  }

  return results;
}

/**
 * 年度別一覧ページ HTML から個別会議詳細ページへのリンクを抽出する。
 * `/site/gikai/{数値}.html` 形式のリンクを対象とする。
 */
export function parseYearListPage(
  html: string
): { url: string; title: string }[] {
  const results: { url: string; title: string }[] = [];
  const seen = new Set<string>();

  // /site/gikai/{数値}.html へのリンク（list47/list48 自身は除外）
  const linkPattern = /<a\s[^>]*href="([^"]*\/site\/gikai\/\d+\.html)"[^>]*>([^<]*)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = match[2]!.trim();

    // list47-* や list48-* は年度別一覧のリンクなので除外
    if (/list\d+-\d+\.html/.test(href)) continue;

    const url = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (seen.has(url)) continue;
    seen.add(url);

    results.push({ url, title: linkText });
  }

  return results;
}

/**
 * 会議詳細ページ HTML から PDF リンクを全件抽出する。
 * `/uploaded/attachment/{数値}.pdf` 形式を対象とする。
 */
export function parseDetailPage(
  html: string,
  pageTitle: string,
  pageUrl: string,
  meetingType: string
): YuasaMeeting[] {
  const meetings: YuasaMeeting[] = [];
  const seen = new Set<string>();

  // ページタイトルから日付を試みる
  const heldOn = parseDateFromTitle(pageTitle);

  const pdfPattern = /<a\s[^>]*href="([^"]*\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  for (const match of html.matchAll(pdfPattern)) {
    const href = match[1]!;

    const pdfUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;

    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    const resolvedMeetingType = detectMeetingType(pageTitle) !== "plenary"
      ? detectMeetingType(pageTitle)
      : meetingType;

    meetings.push({
      pdfUrl,
      title: pageTitle,
      heldOn,
      meetingType: resolvedMeetingType,
      detailPageUrl: pageUrl,
    });
  }

  return meetings;
}

/**
 * 指定年の全会議録 PDF 一覧を取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<YuasaMeeting[]> {
  // Step 1: 議会トップページから年度別一覧 URL を取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const allLinks = parseTopPageAllLinks(topHtml);

  // 対象年の一覧リンクを抽出（年度情報なしのリンクも含めてから後でフィルタ）
  const targetListLinks = allLinks.filter(
    (link) => link.year === year || link.year === null
  );

  if (targetListLinks.length === 0) return [];

  const meetings: YuasaMeeting[] = [];

  for (const listLink of targetListLinks) {
    // Step 2: 年度別一覧ページから会議詳細ページ URL を取得
    const listHtml = await fetchPage(listLink.url);
    if (!listHtml) continue;

    const detailLinks = parseYearListPage(listHtml);

    for (const detailLink of detailLinks) {
      // Step 3: 会議詳細ページから PDF リンクを抽出
      const detailHtml = await fetchPage(detailLink.url);
      if (!detailHtml) continue;

      const pageMeetings = parseDetailPage(
        detailHtml,
        detailLink.title,
        detailLink.url,
        listLink.meetingType
      );
      meetings.push(...pageMeetings);
    }
  }

  return meetings;
}
