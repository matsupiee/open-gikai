/**
 * 清水町議会（北海道） 会議録 — list フェーズ
 *
 * 年別一覧ページ → 議事日程表ページ → 「当日の全会議録へ」リンクの順でクロールする。
 *
 * 新サイト（H29〜）:
 *   年別一覧: ul.title-list 内の <a> タグからリンク抽出
 *   議事日程表: table.table-gray 内の「当日の全会議録へ」リンク
 *
 * 旧サイト（H17〜H28）:
 *   年別一覧: #contents_in 内の <a> タグ（../details/{ID}.html 形式）
 *   会議録本文の形式は新旧共通
 */

import {
  BASE_ORIGIN,
  buildNewSiteYearListUrl,
  buildOldSiteYearListUrl,
  eraToWesternYear,
  fetchPage,
  toHalfWidth,
  westernYearToEraInfo,
} from "./shared";

export interface ShimizuHokkaidoMeeting {
  /** 会議録ページの完全 URL */
  pageUrl: string;
  /** 議事日程表ページの URL（元リンク） */
  scheduleUrl: string;
  /** 会議タイトル（例: "令和7年第5回定例会会議録（9月4日）"） */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** 会議種別（"plenary" / "extraordinary"） */
  category: string;
  /** 外部 ID 用のキー（例: "016365_proceeding_7594922"） */
  pageKey: string;
}

/**
 * 新サイト年別一覧ページから議事日程表 URL を抽出する。
 * ul.title-list 内の <a> タグから href を取得。
 */
export function parseNewSiteYearListPage(
  html: string,
  _baseUrl: string,
): string[] {
  const urls: string[] = [];

  // ul.title-list セクションを抽出
  const ulPattern = /<ul[^>]*class="[^"]*title-list[^"]*"[^>]*>([\s\S]*?)<\/ul>/gi;
  for (const ulMatch of html.matchAll(ulPattern)) {
    const ulHtml = ulMatch[1]!;
    // <a href="..."> を抽出
    const linkPattern = /href="(\/gikai\/(?:proceeding|past\/kaigiroku)\/details\/[^"]+\.html)"/gi;
    for (const linkMatch of ulHtml.matchAll(linkPattern)) {
      const href = linkMatch[1]!;
      const url = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  // ul.title-list が見つからない場合はページ全体から検索
  if (urls.length === 0) {
    const linkPattern = /href="(\/gikai\/(?:proceeding|past\/kaigiroku)\/details\/[^"]+\.html)"/gi;
    for (const linkMatch of html.matchAll(linkPattern)) {
      const href = linkMatch[1]!;
      const url = `${BASE_ORIGIN}${href}`;
      if (!urls.includes(url)) {
        urls.push(url);
      }
    }
  }

  return urls;
}

/**
 * 旧サイト年別一覧ページから議事日程表 URL を抽出する。
 * #contents_in 内の ../details/{ID}.html 形式のリンク。
 */
export function parseOldSiteYearListPage(
  html: string,
  basePageUrl: string,
): string[] {
  const urls: string[] = [];

  // ../details/{ID}.html パターンのリンクを抽出
  const linkPattern = /href="(\.\.\/(details\/[^"]+\.html))"/gi;
  for (const match of html.matchAll(linkPattern)) {
    const relativePath = match[2]!;
    // 旧サイト: /gikai/past/kaigiroku/{年}/index.html から ../details/xxx.html
    // → /gikai/past/kaigiroku/details/xxx.html
    // basePageUrl から pathname のみ取得して二重 origin を防ぐ
    const basePath = basePageUrl
      .replace(BASE_ORIGIN, "")
      .replace(/\/index\.html$/, "");
    const parentPath = basePath.split("/").slice(0, -1).join("/");
    const url = `${BASE_ORIGIN}${parentPath}/${relativePath}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  // /gikai/past/kaigiroku/details/{ID}.html 形式の絶対パスも対応
  const absLinkPattern = /href="(\/gikai\/past\/kaigiroku\/details\/[^"]+\.html)"/gi;
  for (const match of html.matchAll(absLinkPattern)) {
    const url = `${BASE_ORIGIN}${match[1]!}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * 議事日程表ページから「当日の全会議録へ」リンクを抽出する。
 */
export function parseSchedulePage(
  html: string,
  scheduleUrl: string,
): { pageUrl: string; title: string; heldOn: string | null; category: string; pageKey: string }[] {
  const results: { pageUrl: string; title: string; heldOn: string | null; category: string; pageKey: string }[] = [];

  // 「当日の全会議録へ」リンクを抽出
  const fullRecordPattern =
    /href="(\/gikai\/(?:proceeding|past\/kaigiroku)\/details\/([^"]+)\.html)"[^>]*>当日の全会議録へ/g;

  for (const match of html.matchAll(fullRecordPattern)) {
    const href = match[1]!;
    const pageId = match[2]!;
    const pageUrl = `${BASE_ORIGIN}${href}`;
    const pageKey = `016365_proceeding_${pageId}`;

    // タイトルと開催日は後でページから抽出するため、暫定値を設定
    const category = detectCategoryFromUrl(scheduleUrl, html);
    results.push({
      pageUrl,
      title: "",
      heldOn: null,
      category,
      pageKey,
    });
  }

  // 「当日の全会議録へ」リンクがない場合、直接リンクを収集（フォールバック）
  if (results.length === 0) {
    const directPattern =
      /href="(\/gikai\/(?:proceeding|past\/kaigiroku)\/details\/([^"]+)\.html)"/g;
    const seenUrls = new Set<string>([scheduleUrl]);

    for (const match of html.matchAll(directPattern)) {
      const href = match[1]!;
      const pageId = match[2]!;
      const pageUrl = `${BASE_ORIGIN}${href}`;

      if (seenUrls.has(pageUrl)) continue;
      seenUrls.add(pageUrl);

      const pageKey = `016365_proceeding_${pageId}`;
      const category = detectCategoryFromUrl(scheduleUrl, html);
      results.push({
        pageUrl,
        title: "",
        heldOn: null,
        category,
        pageKey,
      });
    }
  }

  return results;
}

/**
 * URL と HTML から会議種別を判定する。
 */
function detectCategoryFromUrl(_url: string, html: string): string {
  // ページタイトルから判定
  const titleMatch = html.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)
    || html.match(/<div[^>]*class="[^"]*page-title[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (titleMatch) {
    const titleText = titleMatch[1]!.replace(/<[^>]+>/g, "").trim();
    if (titleText.includes("臨時会")) return "extraordinary";
  }
  return "plenary";
}

/**
 * 会議録ページの .page-title からメタ情報を抽出する。
 *
 * タイトル例:
 *   「令和7年第5回定例会会議録（9月4日）」
 *   「平成29年第1回定例会会議録（3月6日）」
 */
export function parseMeetingPageMeta(
  html: string,
  year: number,
): { title: string; heldOn: string | null; category: string } {
  // .page-title からタイトルを取得
  let titleText = "";
  const pageTitleMatch =
    html.match(/<h1[^>]*class="[^"]*page-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i) ||
    html.match(/<div[^>]*class="[^"]*page-title[^"]*"[^>]*>([\s\S]*?)<\/div>/i) ||
    html.match(/<p[^>]*class="[^"]*page-title[^"]*"[^>]*>([\s\S]*?)<\/p>/i);

  if (pageTitleMatch) {
    titleText = pageTitleMatch[1]!.replace(/<[^>]+>/g, "").trim();
  }

  const title = toHalfWidth(titleText);

  // 会議種別
  const category = title.includes("臨時会") ? "extraordinary" : "plenary";

  // 開催日: 括弧内の「M月D日」を抽出し、year と組み合わせる
  const heldOn = parseDateFromTitle(title, year);

  return { title: titleText || title, heldOn, category };
}

/**
 * タイトルから開催日を抽出する。
 * 「（9月4日）」などのパターンに対応。
 * 年をまたぐ場合（例: 令和6年の会議録が1月）の考慮も行う。
 */
export function parseDateFromTitle(
  title: string,
  year: number,
): string | null {
  const halfTitle = toHalfWidth(title);

  // 括弧内の月日を抽出: （M月D日）
  const dateMatch = halfTitle.match(/[（(](\d+)月(\d+)日[）)]/);
  if (!dateMatch) return null;

  const month = parseInt(dateMatch[1]!, 10);
  const day = parseInt(dateMatch[2]!, 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 和暦年テキストから会議録タイトルに含まれる開催年を抽出する。
 * 例: 「令和7年第5回定例会会議録（9月4日）」 → 2025
 */
export function parseYearFromTitle(title: string): number | null {
  const halfTitle = toHalfWidth(title);
  const eraMatch = halfTitle.match(/(令和|平成)(元|\d+)年/);
  if (!eraMatch) return null;
  return eraToWesternYear(`${eraMatch[1]}${eraMatch[2]}年`);
}

/**
 * 指定年の会議一覧を取得する。
 */
export async function fetchMeetingList(
  year: number,
): Promise<ShimizuHokkaidoMeeting[]> {
  const eraInfo = westernYearToEraInfo(year);
  if (!eraInfo) return [];

  const yearListUrl =
    eraInfo.site === "new"
      ? buildNewSiteYearListUrl(eraInfo.eraNum)
      : buildOldSiteYearListUrl(eraInfo.eraNum);

  const yearHtml = await fetchPage(yearListUrl);
  if (!yearHtml) return [];

  const scheduleUrls =
    eraInfo.site === "new"
      ? parseNewSiteYearListPage(yearHtml, yearListUrl)
      : parseOldSiteYearListPage(yearHtml, yearListUrl);

  const allMeetings: ShimizuHokkaidoMeeting[] = [];

  for (const scheduleUrl of scheduleUrls) {
    const scheduleHtml = await fetchPage(scheduleUrl);
    if (!scheduleHtml) continue;

    const recordLinks = parseSchedulePage(scheduleHtml, scheduleUrl);
    for (const link of recordLinks) {
      allMeetings.push({
        pageUrl: link.pageUrl,
        scheduleUrl,
        title: link.title,
        heldOn: link.heldOn,
        category: link.category,
        pageKey: link.pageKey,
      });
    }
  }

  return allMeetings;
}
