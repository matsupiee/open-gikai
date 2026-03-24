/**
 * 嵐山町議会 会議録 — list フェーズ
 *
 * 一覧トップページから年度別カテゴリ URL を収集し、
 * 各年度カテゴリページから個別会議録ページ URL を抽出する。
 * 個別会議録ページから PDF URL を取得する。
 *
 * ページ構造:
 *   一覧トップ → 年度別カテゴリページ → 個別会議録ページ → PDF URL
 */

import {
  BASE_ORIGIN,
  detectMeetingType,
  eraToWesternYear,
  fetchPage,
  fileNameToMonth,
  fileNameToYear,
} from "./shared";

export interface RanzanMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第3回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD（月のみ判明の場合は YYYY-MM-01） */
  heldOn: string;
  /** 会議種別 */
  meetingType: string;
}

/**
 * 一覧トップページ HTML から年度別カテゴリページの URL を抽出する。
 *
 * パターン:
 *   <h2><a href="../category/2-19-9-{ID}-0-0-0-0-0-0.html">令和7年</a></h2>
 *   または直接リンク
 */
export function parseCategoryUrls(
  html: string,
): Array<{ url: string; year: number }> {
  const results: Array<{ url: string; year: number }> = [];
  const seen = new Set<string>();

  // カテゴリリンクを抽出（年度名付き）
  const linkPattern =
    /<a[^>]+href="([^"]*category\/2-19-9-\d+-[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const text = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 年度テキストから西暦年を取得
    const year = eraToWesternYear(text);
    if (!year) continue;

    // 相対 URL を絶対 URL に変換
    let url: string;
    if (href.startsWith("http")) {
      url = href;
    } else if (href.startsWith("../")) {
      url = `${BASE_ORIGIN}/${href.replace(/^\.\.\//, "")}`;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      url = `${BASE_ORIGIN}/${href}`;
    }

    if (!seen.has(url)) {
      seen.add(url);
      results.push({ url, year });
    }
  }

  return results;
}

/**
 * 年度別カテゴリページ HTML から個別会議録ページの URL を抽出する。
 *
 * パターン:
 *   <ul>
 *     <li><a href="https://www.town.ranzan.saitama.jp/0000007843.html">決算審査特別委員会会議録</a></li>
 *   </ul>
 */
export function parseArticleUrls(
  html: string,
): Array<{ url: string; title: string }> {
  const results: Array<{ url: string; title: string }> = [];
  const seen = new Set<string>();

  // 個別記事ページへのリンクを抽出（数字IDのパターン）
  const linkPattern =
    /<a[^>]+href="(https?:\/\/www\.town\.ranzan\.saitama\.jp\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const url = match[1]!;
    const title = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (!seen.has(url) && title) {
      seen.add(url);
      results.push({ url, title });
    }
  }

  return results;
}

/**
 * 個別会議録ページ HTML から PDF URL を抽出する。
 *
 * パターン:
 *   <a href="./cmsfiles/contents/{グループID}/{記事ID}/{ファイル名}.pdf">
 */
export function parsePdfUrl(html: string): string | null {
  const pdfPattern = /<a[^>]+href="([^"]*cmsfiles\/contents\/[^"]+\.pdf)"[^>]*>/i;
  const match = html.match(pdfPattern);
  if (!match) return null;

  const href = match[1]!;

  // 相対 URL を絶対 URL に変換
  if (href.startsWith("http")) {
    return href;
  } else if (href.startsWith("./")) {
    // ./cmsfiles/... → baseUrl/cmsfiles/...
    return `${BASE_ORIGIN}/${href.replace(/^\.\//, "")}`;
  } else if (href.startsWith("/")) {
    return `${BASE_ORIGIN}${href}`;
  } else {
    return `${BASE_ORIGIN}/${href}`;
  }
}

/**
 * PDF ファイル名と会議タイトルから heldOn を構築する。
 * ファイル名から年月を解析できる場合はそれを使う。
 * 解析できない場合は null を返す。
 */
export function buildHeldOn(
  pdfUrl: string,
  year: number,
): string | null {
  const fileName = pdfUrl.split("/").pop() ?? "";
  const month = fileNameToMonth(fileName);
  const fileYear = fileNameToYear(fileName);

  // ファイル名から年が取れた場合はそちらを優先（年度またぎ対応）
  const actualYear = fileYear ?? year;

  if (!month) return null;

  return `${actualYear}-${String(month).padStart(2, "0")}-01`;
}

/**
 * 指定年の会議録リストを取得する。
 *
 * baseUrl (一覧トップ URL) から年度別カテゴリ URL を取得し、
 * 対象年の個別会議録ページを巡回して PDF URL を収集する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<RanzanMeeting[]> {
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const categories = parseCategoryUrls(topHtml);

  // 対象年のカテゴリのみを処理
  const targetCategories = categories.filter((c) => c.year === year);

  const meetings: RanzanMeeting[] = [];

  for (const category of targetCategories) {
    const categoryHtml = await fetchPage(category.url);
    if (!categoryHtml) continue;

    const articles = parseArticleUrls(categoryHtml);

    for (const article of articles) {
      const articleHtml = await fetchPage(article.url);
      if (!articleHtml) continue;

      const pdfUrl = parsePdfUrl(articleHtml);
      if (!pdfUrl) continue;

      const heldOn = buildHeldOn(pdfUrl, year);
      if (!heldOn) continue;

      meetings.push({
        pdfUrl,
        title: article.title,
        heldOn,
        meetingType: detectMeetingType(article.title),
      });
    }
  }

  return meetings;
}
