/**
 * 八女市議会（福岡県） — list フェーズ
 *
 * 3段階で PDF リンクを収集する:
 * 1. トップページから年度ディレクトリ一覧を抽出
 * 2. 各年度インデックスから会議詳細ページへのリンクを抽出
 * 3. 各会議詳細ページから会議録 PDF リンクを抽出
 */

import {
  BASE_ORIGIN,
  BASE_PATH,
  detectMeetingType,
  fetchPage,
  parseDateText,
  yearDirToWesternYear,
} from "./shared";

export interface YameMeeting {
  /** PDF ダウンロード URL */
  pdfUrl: string;
  /** 会議タイトル（例: 令和7年第1回臨時会） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別 plenary/extraordinary/committee */
  meetingType: string;
  /** 個別ページ URL（sourceUrl として利用） */
  pageUrl: string;
}

/**
 * 相対/絶対 URL を完全 URL に変換する。
 */
function toAbsoluteUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  // 相対パス
  const base = baseUrl.replace(/\/[^/]*$/, "");
  return `${base}/${href}`;
}

/**
 * トップページから年度ディレクトリパスを抽出する（テスト可能な純粋関数）。
 *
 * 抽出対象:
 *   href="shisei/12/7/{年号}/index.html"
 *   href="shisei/12/7/kako-kaigikekka/{年号}/index.html"
 *
 * 戻り値: 年号ディレクトリ文字列のリスト
 *   例: ["R8", "R7_1", "kako-kaigikekka/R6_1", "kako-kaigikekka/reiwa4", ...]
 */
export function parseTopPage(html: string): string[] {
  const results: string[] = [];
  const seen = new Set<string>();

  // パターン1: shisei/12/7/{年号}/index.html (最新2年)
  const directRegex =
    /shisei\/12\/7\/((?!kako-kaigikekka)[A-Za-z0-9_]+)\/index\.html/g;
  for (const match of html.matchAll(directRegex)) {
    const dir = match[1]!;
    if (!seen.has(dir)) {
      seen.add(dir);
      results.push(dir);
    }
  }

  // パターン2: shisei/12/7/kako-kaigikekka/{年号}/index.html
  const kakoRegex =
    /shisei\/12\/7\/(kako-kaigikekka\/[A-Za-z0-9_]+)\/index\.html/g;
  for (const match of html.matchAll(kakoRegex)) {
    const dir = match[1]!;
    if (!seen.has(dir)) {
      seen.add(dir);
      results.push(dir);
    }
  }

  return results;
}

/**
 * 年度インデックスページから会議詳細ページへのリンクを抽出する（テスト可能な純粋関数）。
 *
 * 抽出対象: href="{年号}/{記事ID}.html"
 * 戻り値: { title, pageUrl }[]
 */
export function parseYearIndexPage(
  html: string,
  yearDirUrl: string,
): { title: string; pageUrl: string }[] {
  const results: { title: string; pageUrl: string }[] = [];
  const seen = new Set<string>();

  // 数値 ID の .html ページへのリンクを抽出
  const linkRegex =
    /<a[^>]+href="([^"]*\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const rawTitle = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    // 会議録に関連するリンクのみ（定例会・臨時会・委員会等を含む）
    if (
      !rawTitle.includes("定例会") &&
      !rawTitle.includes("臨時会") &&
      !rawTitle.includes("委員会") &&
      !rawTitle.includes("会議録")
    ) {
      continue;
    }

    const pageUrl = toAbsoluteUrl(href, yearDirUrl);
    if (seen.has(pageUrl)) continue;
    seen.add(pageUrl);

    results.push({ title: rawTitle, pageUrl });
  }

  return results;
}

/**
 * 会議詳細ページから会議録 PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * 「会期日程」「議決結果一覧表」はスキップし、会議録 PDF のみ抽出する。
 * 開催日は PDF リンクのテキストや会議タイトルから取得する。
 */
export function parseMeetingPage(
  html: string,
  meetingTitle: string,
  pageUrl: string,
): YameMeeting[] {
  const results: YameMeeting[] = [];
  const meetingType = detectMeetingType(meetingTitle);

  // PDF リンクを全て抽出
  const linkRegex = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    // 会期日程・議決結果一覧は除外
    if (
      linkText.includes("会期日程") ||
      linkText.includes("議決結果") ||
      linkText.includes("一覧表")
    ) {
      continue;
    }

    // 会議録 PDF のみ（テキストに「会議録」または「分」を含むもの、
    // もしくはリンクテキストから日付が取れるもの）
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    const pdfUrl = toAbsoluteUrl(href, pageUrl);

    results.push({
      pdfUrl,
      title: meetingTitle,
      heldOn,
      meetingType,
      pageUrl,
    });
  }

  return results;
}

/**
 * 指定年の全 PDF リンクを取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<YameMeeting[]> {
  // Step 1: トップページから年度ディレクトリ一覧を取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearDirs = parseTopPage(topHtml);
  if (yearDirs.length === 0) return [];

  // 指定年にマッチする年度ディレクトリのみ絞り込む
  const matchedDirs = yearDirs.filter((dir) => {
    const westernYear = yearDirToWesternYear(dir);
    return westernYear === year;
  });

  if (matchedDirs.length === 0) return [];

  const allMeetings: YameMeeting[] = [];

  for (const yearDir of matchedDirs) {
    // Step 2: 年度インデックスページから会議詳細リンクを取得
    const yearIndexUrl = `${BASE_ORIGIN}${BASE_PATH}/${yearDir}/index.html`;
    const indexHtml = await fetchPage(yearIndexUrl);
    if (!indexHtml) continue;

    const detailPages = parseYearIndexPage(indexHtml, yearIndexUrl);
    if (detailPages.length === 0) continue;

    for (let i = 0; i < detailPages.length; i++) {
      const page = detailPages[i]!;

      // Step 3: 会議詳細ページから PDF リンクを取得
      const detailHtml = await fetchPage(page.pageUrl);
      if (!detailHtml) continue;

      const meetings = parseMeetingPage(detailHtml, page.title, page.pageUrl);
      allMeetings.push(...meetings);

      // レート制限: 最後のリクエスト後は待たない
      if (i < detailPages.length - 1) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  return allMeetings;
}
