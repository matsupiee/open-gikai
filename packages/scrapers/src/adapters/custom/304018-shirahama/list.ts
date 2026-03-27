/**
 * 白浜町議会（和歌山県） — list フェーズ
 *
 * 2段階クロール:
 * 1. 過去の会議録 年度インデックスページから年度別ページ URL を収集する
 * 2. 各年度ページから PDF リンクを抽出する
 *
 * 最新の会議録ページも同様に処理し、重複排除を行う。
 * 各 PDF が fetchDetail の1レコードに対応する。
 */

import {
  BASE_ORIGIN,
  KAKO_INDEX_URL,
  SAISHIN_TOP_URL,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface ShirahamaSessionInfo {
  /** 会議タイトル */
  title: string;
  /** 開催日 YYYY-MM-DD（解析できない場合は null） */
  heldOn: string | null;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** 年度別ページの絶対 URL */
  yearPageUrl: string;
  /** 会議種別 */
  meetingType: "plenary" | "extraordinary" | "committee";
}

const INTER_REQUEST_DELAY_MS = 1500;

/**
 * 過去の会議録インデックスページから年度別詳細ページ URL を抽出する。
 *
 * パターン: /soshiki/gikai/gyomu/kaigiroku/kako/{ID}.html 形式のリンク
 */
export function extractKakoPageUrls(html: string): string[] {
  const urls: string[] = [];
  const pattern = /href="((?:https?:\/\/[^"]*)?\/soshiki\/gikai\/gyomu\/kaigiroku\/kako\/[^"]+\.html)"/g;

  for (const match of html.matchAll(pattern)) {
    const rawHref = match[1];
    if (!rawHref) continue;
    // インデックスページ自体は除外
    if (rawHref.endsWith("index.html")) continue;
    // 絶対 URL の場合はそのまま使用、相対パスの場合は BASE_ORIGIN を付加
    const url = rawHref.startsWith("http") ? rawHref : `${BASE_ORIGIN}${rawHref}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * 最新の会議録トップページから詳細ページ URL を抽出する。
 *
 * パターン: /soshiki/gikai/gyomu/kaigiroku/saishinnokaigiroku/{ID}.html 形式のリンク
 */
export function extractSaishinPageUrls(html: string): string[] {
  const urls: string[] = [];
  const pattern = /href="(\/soshiki\/gikai\/gyomu\/kaigiroku\/saishinnokaigiroku\/[^"]+\.html)"/g;

  for (const match of html.matchAll(pattern)) {
    const path = match[1];
    if (!path) continue;
    const url = `${BASE_ORIGIN}${path}`;
    if (!urls.includes(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/**
 * 月日テキストから開催日を YYYY-MM-DD に変換する。
 *
 * linkText 例: "第1号 9月3日", "第1号 1月24日"
 * 年はページの年度コンテキストから与えられる。
 */
export function parseDateFromLinkText(
  linkText: string,
  year: number | null,
): string | null {
  if (year === null) return null;

  const dateMatch = linkText.match(/(\d+)月(\d+)日/);
  if (!dateMatch) return null;

  const month = parseInt(dateMatch[1] ?? "0", 10);
  const day = parseInt(dateMatch[2] ?? "0", 10);

  if (month <= 0 || month > 12 || day <= 0 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年度別詳細ページ HTML から PDF セッション情報を抽出する。
 *
 * HTML 構造例（令和6年ページ）:
 * <a href="//www.town.shirahama.wakayama.jp/material/files/group/51/20240124kaigiroku.pdf">第1号 1月24日</a>
 */
export function parsePdfLinks(
  html: string,
  yearPageUrl: string,
  sectionTitle: string,
  year: number | null,
): ShirahamaSessionInfo[] {
  const results: ShirahamaSessionInfo[] = [];
  const seenUrls = new Set<string>();

  // href が .pdf で終わるリンクを抽出（プロトコル相対 URL も対応）
  const pattern = /href="((?:https?:)?\/\/[^"]+\.pdf)"[^>]*>([^<]+)/gi;

  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    const linkText = match[2]?.trim();

    if (!href || !linkText) continue;

    // プロトコル相対 URL を絶対 URL に変換
    const pdfUrl = href.startsWith("//") ? `https:${href}` : href;

    if (seenUrls.has(pdfUrl)) continue;
    seenUrls.add(pdfUrl);

    const heldOn = parseDateFromLinkText(linkText, year);
    const title = sectionTitle
      ? `${sectionTitle} ${linkText}`
      : linkText;
    const meetingType = detectMeetingType(title);

    results.push({
      title,
      heldOn,
      pdfUrl,
      yearPageUrl,
      meetingType,
    });
  }

  return results;
}

/**
 * 年度別ページの H 要素テキストからページのタイトルを取得する。
 */
export function extractPageTitle(html: string): string {
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match?.[1]) return h1Match[1].trim();

  const h2Match = html.match(/<h2[^>]*>([^<]+)<\/h2>/i);
  if (h2Match?.[1]) return h2Match[1].trim();

  return "";
}

/**
 * 年度別ページ HTML から西暦年を推定する。
 */
export function extractYearFromHtml(html: string): number | null {
  // title タグから
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    const year = parseWarekiYear(titleMatch[1]);
    if (year) return year;
  }

  // h1 から
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match?.[1]) {
    const year = parseWarekiYear(h1Match[1]);
    if (year) return year;
  }

  // h2 から
  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (h2Match?.[1]) {
    const year = parseWarekiYear(h2Match[1].replace(/<[^>]+>/g, ""));
    if (year) return year;
  }

  // ページ本文から（最初の和暦を探す）
  const bodyYear = parseWarekiYear(html);
  return bodyYear;
}

/**
 * 全ての年度別ページ URL を収集する。
 * 過去の会議録インデックスと最新の会議録トップの両方から収集し重複排除する。
 */
export async function fetchAllPageUrls(): Promise<string[]> {
  const urlSet = new Set<string>();

  // 過去の会議録インデックスページから収集
  const kakoHtml = await fetchPage(KAKO_INDEX_URL);
  if (kakoHtml) {
    for (const url of extractKakoPageUrls(kakoHtml)) {
      urlSet.add(url);
    }
  }

  await delay(INTER_REQUEST_DELAY_MS);

  // 最新の会議録トップページから詳細ページ URL を収集
  const saishinHtml = await fetchPage(SAISHIN_TOP_URL);
  if (saishinHtml) {
    for (const url of extractSaishinPageUrls(saishinHtml)) {
      urlSet.add(url);
    }
  }

  return Array.from(urlSet);
}

/**
 * 指定年のセッション一覧を取得する。
 */
export async function fetchSessionList(year: number): Promise<ShirahamaSessionInfo[]> {
  const pageUrls = await fetchAllPageUrls();
  const allSessions: ShirahamaSessionInfo[] = [];
  const seenPdfUrls = new Set<string>();

  for (const pageUrl of pageUrls) {
    await delay(INTER_REQUEST_DELAY_MS);

    const html = await fetchPage(pageUrl);
    if (!html) continue;

    // このページが対象年に属するか確認
    const pageYear = extractYearFromHtml(html);
    if (pageYear !== null && pageYear !== year) continue;

    const pageTitle = extractPageTitle(html);
    const sessions = parsePdfLinks(html, pageUrl, pageTitle, pageYear ?? year);

    for (const session of sessions) {
      if (!seenPdfUrls.has(session.pdfUrl)) {
        seenPdfUrls.add(session.pdfUrl);
        allSessions.push(session);
      }
    }
  }

  return allSessions;
}
