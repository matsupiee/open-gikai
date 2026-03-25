/**
 * 八千代町議会 — list フェーズ
 *
 * 3段階で PDF リンクを収集する:
 * 1. トップページ (dir000425.html) から年度別ページ URL を取得
 * 2. 年度別ページ (dir{XXXXXX}.html) から会議詳細ページ URL を取得
 * 3. 各会議詳細ページ (page{XXXXXX}.html) から会議録 PDF リンクを取得
 */

import { BASE_ORIGIN, eraToWesternYear, fetchPage, toJapaneseEra } from "./shared";

export interface YachiyoMeeting {
  /** 会議タイトル（例: "令和6年第4回定例会"） */
  title: string;
  /** 会議詳細ページの URL */
  pageUrl: string;
  /** 会議録 PDF の URL 一覧（審議結果を除く） */
  pdfUrls: string[];
}

/**
 * トップページから年度別ページのリンクを抽出する。
 * `dir{XXXXXX}.html` 形式のリンクをすべて抽出する。
 */
export function parseTopPage(
  html: string,
): { label: string; url: string }[] {
  const results: { label: string; url: string }[] = [];

  // dir{XXXXXX}.html 形式のリンクを探す（トップページ dir000425.html 自体は除外）
  const linkRegex = /<a[^>]+href="([^"]*dir(\d+)\.html)"[^>]*>([^<]*)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = match[3]!.trim();

    // 年度ラベル: 「令和N年」or「平成N年」を含む
    if (!/(令和|平成)(元|\d+)年/.test(label)) continue;
    // 会議名が含まれる場合はスキップ（年度ナビのみ抽出）
    if (label.includes("定例会") || label.includes("臨時会")) continue;

    // 相対パスを絶対URLに変換
    const absoluteUrl = toAbsoluteUrl(href);

    // 重複排除
    if (!results.some((r) => r.url === absoluteUrl)) {
      results.push({ label, url: absoluteUrl });
    }
  }

  return results;
}

/**
 * 相対URLを絶対URLに変換する。
 */
function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  // 相対パス（例: "../page/dir012601.html" or "dir012601.html"）
  // サイト構造: https://www.town.ibaraki-yachiyo.lg.jp/page/dir{XXXXXX}.html
  const cleaned = href.replace(/^\.\.\//, "");
  if (!cleaned.startsWith("/")) {
    return `${BASE_ORIGIN}/${cleaned}`;
  }
  return `${BASE_ORIGIN}${cleaned}`;
}

/**
 * 年度ページから会議詳細ページのリンクを抽出する。
 * `page{XXXXXX}.html` 形式のリンクを探す。
 */
export function parseYearPage(
  html: string,
): { title: string; url: string }[] {
  const results: { title: string; url: string }[] = [];

  const linkRegex = /<a[^>]+href="([^"]*page\d+\.html)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const title = match[2]!.trim();

    if (!title.includes("定例会") && !title.includes("臨時会")) continue;

    const absoluteUrl = toAbsoluteUrl(href);

    if (!results.some((r) => r.url === absoluteUrl)) {
      results.push({ title, url: absoluteUrl });
    }
  }

  return results;
}

/**
 * 会議詳細ページから会議録 PDF のリンクを抽出する。
 * 審議結果 PDF は除外し、会議録 PDF のみを返す。
 *
 * 八千代町のPDFリンクパターン: `../data/doc/{タイムスタンプ}_doc_{XX}_0.pdf`
 * 審議結果: リンクテキストに「審議結果」を含む
 */
export function parseMeetingPage(
  html: string,
): string[] {
  const pdfUrls: string[] = [];

  const linkRegex = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 審議結果 PDF をスキップ
    if (/審議結果/i.test(linkText)) continue;

    const absoluteUrl = toAbsoluteUrl(href);

    if (!pdfUrls.includes(absoluteUrl)) {
      pdfUrls.push(absoluteUrl);
    }
  }

  return pdfUrls;
}

/**
 * 会議タイトルから開催年（西暦）を抽出する。
 * e.g., "令和6年第4回定例会" → 2024
 */
export function extractYearFromTitle(title: string): number | null {
  const match = title.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWesternYear(match[1]!, match[2]!);
}

/**
 * 指定年の会議一覧を取得する。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<YachiyoMeeting[]> {
  // Step 1: トップページから年度別ページを取得
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml);
  const eraTexts = toJapaneseEra(year);

  // 対象年度のページを見つける
  const targetPages = yearPages.filter((p) =>
    eraTexts.some((era) => p.label.includes(era)),
  );
  if (targetPages.length === 0) return [];

  // Step 2: 年度ページから個別会議ページリンクを取得
  const meetingLinks: { title: string; url: string }[] = [];
  for (const page of targetPages) {
    const yearHtml = await fetchPage(page.url);
    if (!yearHtml) continue;
    const links = parseYearPage(yearHtml);
    // 対象年の会議のみフィルタ
    for (const link of links) {
      const meetingYear = extractYearFromTitle(link.title);
      if (meetingYear === year && !meetingLinks.some((m) => m.url === link.url)) {
        meetingLinks.push(link);
      }
    }
  }

  // Step 3: 各会議ページから PDF リンクを取得
  const meetings: YachiyoMeeting[] = [];
  for (let i = 0; i < meetingLinks.length; i++) {
    const link = meetingLinks[i]!;
    const pageHtml = await fetchPage(link.url);
    if (!pageHtml) continue;

    const pdfUrls = parseMeetingPage(pageHtml);
    if (pdfUrls.length > 0) {
      meetings.push({
        title: link.title,
        pageUrl: link.url,
        pdfUrls,
      });
    }

    if (i < meetingLinks.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return meetings;
}
