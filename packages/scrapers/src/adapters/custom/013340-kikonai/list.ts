/**
 * 木古内町議会 会議録 -- list フェーズ
 *
 * 3 階層のクロールで全 PDF リンクを収集する:
 *   1. 会議録トップページから年度別リンクを取得
 *   2. 各年度ページから会議種別リンクを取得
 *   3. 各会議種別ページから PDF リンクと開催日を取得
 *
 * 年号コードと西暦年の対応:
 *   R7=2025, R6=2024, ..., H31=2019, H30=2018, ..., H25=2013
 */

import {
  BASE_ORIGIN,
  TOP_PAGE_URL,
  eraCodeToYear,
  parseHeldOn,
  fetchPage,
} from "./shared";

export interface KikonaiMeeting {
  /** PDF の完全 URL */
  pdfUrl: string;
  /** 会議タイトル（例: "第1回定例会"） */
  title: string;
  /** 開催日 YYYY-MM-DD */
  heldOn: string;
  /** 会議種別（例: "定例会", "委員会"） */
  category: string;
}

/** 絶対 URL を組み立てる */
function toAbsoluteUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  if (href.startsWith("/")) {
    return `${BASE_ORIGIN}${href}`;
  }
  // 相対パス
  const base = baseUrl.replace(/\/[^/]*$/, "/");
  return `${base}${href}`;
}

/**
 * 会議録トップページ HTML から年度別ページへのリンクを抽出する。
 *
 * パターン: /gikai/kaigiroku/{年号}/
 * 年号: R7, R6, ..., H25 等
 */
export function parseTopPage(html: string): { url: string; eraCode: string; year: number }[] {
  const results: { url: string; eraCode: string; year: number }[] = [];
  const linkPattern = /href="(\/gikai\/kaigiroku\/(R\d+|H\d+)\/?)"/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const eraCode = match[2]!;
    const year = eraCodeToYear(eraCode);
    if (!year) continue;

    const url = `${BASE_ORIGIN}${href.endsWith("/") ? href : `${href}/`}`;

    // 重複チェック
    if (results.some((r) => r.eraCode === eraCode)) continue;

    results.push({ url, eraCode, year });
  }

  return results;
}

/**
 * 年度別ページ HTML から会議種別ページへのリンクを抽出する。
 *
 * パターン: /gikai/kaigiroku/{年号}/{種別}.html
 */
export function parseYearPage(html: string, yearPageUrl: string): string[] {
  const urls: string[] = [];
  // 年号を URL から取得
  const yearMatch = yearPageUrl.match(/\/kaigiroku\/(R\d+|H\d+)\//);
  if (!yearMatch) return urls;
  const eraCode = yearMatch[1]!;

  // 同一年度配下の .html リンクを取得
  const pattern = new RegExp(
    `href="([^"]*\/kaigiroku\\/${eraCode}\\/[^"]+\\.html)"`,
    "gi",
  );

  const seen = new Set<string>();
  for (const match of html.matchAll(pattern)) {
    const href = match[1]!;
    const url = toAbsoluteUrl(href, yearPageUrl);
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls;
}

/**
 * PDF リンクの近辺テキストから開催日と会議タイトルを抽出する。
 *
 * 会議種別ページでは PDF リンクの周辺に開催日情報がある。
 * 例:
 *   令和6年3月4日～3月11日  <a href="/files/.../第1回定例会.pdf">第1回定例会</a>
 *   令和6年6月20日         <a href="/files/.../第2回定例会.pdf">第2回定例会</a>
 */
export function parseMeetingPage(
  html: string,
  pageUrl: string,
): { pdfUrl: string; title: string; heldOn: string | null }[] {
  const results: { pdfUrl: string; title: string; heldOn: string | null }[] = [];

  // PDF リンクを抽出: /files/ 配下の .pdf
  const pdfPattern = /href="([^"]*\/files\/[^"]+\.pdf)"/gi;

  for (const match of html.matchAll(pdfPattern)) {
    const href = match[1]!;
    const pdfUrl = toAbsoluteUrl(href, pageUrl);

    // ファイル名からタイトルを取得（URLデコード）
    const fileNameMatch = pdfUrl.match(/\/([^/]+)\.pdf$/i);
    let title = fileNameMatch?.[1]
      ? decodeURIComponent(fileNameMatch[1])
      : "会議録";

    // PDF リンクの直前のテキストから開催日を探す
    // リンクの index を取得
    const linkIndex = match.index ?? 0;
    // 前後300文字を探索
    const surrounding = html.substring(Math.max(0, linkIndex - 300), linkIndex);

    // 和暦パターンを探す（直近のものを使用）
    const dateMatches = [
      ...surrounding.matchAll(/(令和|平成)(元|\d+)年\d+月\d+日/g),
    ];
    let heldOn: string | null = null;
    if (dateMatches.length > 0) {
      // 最後にマッチしたもの（最も近い）を使用
      const lastDate = dateMatches[dateMatches.length - 1]![0];
      heldOn = parseHeldOn(lastDate);
    }

    // リンクテキストからタイトルを取得（より正確）
    const linkTextMatch = html
      .substring(linkIndex, linkIndex + 200)
      .match(/>([^<]+)<\/a>/);
    if (linkTextMatch?.[1]) {
      const linkText = linkTextMatch[1].trim();
      if (linkText && linkText !== "") {
        title = linkText;
      }
    }

    results.push({ pdfUrl, title, heldOn });
  }

  return results;
}

/**
 * 会議種別ページの URL からカテゴリを推定する。
 */
export function categoryFromPageUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("teireikai") || lower.includes("reireikai")) return "定例会";
  if (lower.includes("rinji") || lower.includes("rinzi")) return "臨時会";
  if (lower.includes("soumu")) return "常任委員会";
  if (lower.includes("yosan")) return "予算等審査特別委員会";
  if (lower.includes("kessan")) return "決算審査特別委員会";
  if (lower.includes("tyoutoku")) return "議会改革調査特別委員会";
  if (lower.includes("tokubet") || lower.includes("tokubetu")) return "特別委員会";
  return "会議";
}

/**
 * 指定年の会議録 PDF リンクを取得する。
 *
 * 1. トップページから全年度リンクを取得
 * 2. 指定年でフィルタ
 * 3. 年度ページから会議種別リンクを収集
 * 4. 各会議種別ページから PDF リンクを収集
 */
export async function fetchMeetingList(year: number): Promise<KikonaiMeeting[]> {
  const topHtml = await fetchPage(TOP_PAGE_URL);
  if (!topHtml) return [];

  const yearEntries = parseTopPage(topHtml);
  const targetEntry = yearEntries.find((e) => e.year === year);
  if (!targetEntry) return [];

  const yearHtml = await fetchPage(targetEntry.url);
  if (!yearHtml) return [];

  const meetingPageUrls = parseYearPage(yearHtml, targetEntry.url);

  const results: KikonaiMeeting[] = [];

  for (const pageUrl of meetingPageUrls) {
    const pageHtml = await fetchPage(pageUrl);
    if (!pageHtml) continue;

    const category = categoryFromPageUrl(pageUrl);
    const items = parseMeetingPage(pageHtml, pageUrl);

    for (const item of items) {
      if (!item.heldOn) continue;

      results.push({
        pdfUrl: item.pdfUrl,
        title: item.title,
        heldOn: item.heldOn,
        category,
      });
    }
  }

  return results;
}
