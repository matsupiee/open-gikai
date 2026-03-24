/**
 * 川南町議会 -- list フェーズ
 *
 * 3段階クロール:
 *   1. 会議録一覧ページ (/site/gikai/1028.html) から年度別一覧ページのリンクを収集
 *   2. 年度別一覧ページ (/soshiki/11/{記事ID}.html) から個別会議録ページのリンクを収集
 *   3. 個別会議録ページから PDF URL を収集
 *
 * 対象年度の会議録のみを抽出し、PDF URL・会議名・会議種別を返す。
 */

import {
  BASE_ORIGIN,
  LIST_PAGE_URL,
  detectMeetingType,
  parseWarekiYear,
  fetchPage,
  delay,
} from "./shared";

export interface KawaminamiPdfRecord {
  /** 会議タイトル（例: "令和6年第4回（12月）定例会"） */
  title: string;
  /** 個別会議録ページの記事 ID */
  pageId: string;
  /** 個別会議録ページの絶対 URL */
  pageUrl: string;
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** PDF リンクのテキスト（初日/2日目/議員名など） */
  pdfLabel: string;
  /** 会議種別 */
  meetingType: string;
}

const INTER_PAGE_DELAY_MS = 1500;

/**
 * 指定年の全 PDF レコードを収集する。
 */
export async function fetchPdfRecordList(
  _baseUrl: string,
  year: number
): Promise<KawaminamiPdfRecord[]> {
  // Step 1: 年度別一覧ページのリンクを収集
  const yearlyPageHtml = await fetchPage(LIST_PAGE_URL);
  if (!yearlyPageHtml) return [];

  const yearlyLinks = parseYearlyPageLinks(yearlyPageHtml);

  // Step 2: 対象年度の一覧ページリンクを抽出
  const targetLinks = yearlyLinks.filter((link) => {
    const seirekiYear = parseWarekiYear(link.title);
    return seirekiYear !== null && seirekiYear === year;
  });

  if (targetLinks.length === 0) return [];

  const allRecords: KawaminamiPdfRecord[] = [];

  for (const yearlyLink of targetLinks) {
    await delay(INTER_PAGE_DELAY_MS);

    // Step 3: 年度別一覧ページから個別会議録ページのリンクを収集
    const yearlyHtml = await fetchPage(yearlyLink.url);
    if (!yearlyHtml) continue;

    const sessionLinks = parseSessionLinks(yearlyHtml);

    // Step 4: 各個別会議録ページから PDF リンクを収集
    for (const sessionLink of sessionLinks) {
      await delay(INTER_PAGE_DELAY_MS);

      const sessionHtml = await fetchPage(sessionLink.url);
      if (!sessionHtml) continue;

      const pdfLinks = parsePdfLinks(sessionHtml, sessionLink.title, sessionLink.pageId, sessionLink.url);
      allRecords.push(...pdfLinks);
    }
  }

  return allRecords;
}

// --- HTML パーサー（テスト用に export） ---

export interface YearlyPageLink {
  title: string;
  url: string;
}

/**
 * 会議録一覧ページ HTML から年度別一覧ページのリンクを抽出する。
 * リンク形式: <a href="/soshiki/11/{記事ID}.html">令和X年</a>
 */
export function parseYearlyPageLinks(html: string): YearlyPageLink[] {
  const links: YearlyPageLink[] = [];
  const seen = new Set<string>();

  const pattern = /<a\s[^>]*href="(\/soshiki\/11\/\d+\.html)"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const href = m[1]!;
    const title = m[2]!.replace(/\s+/g, " ").trim();

    // 年度名（令和X年 / 平成X年）のみ対象
    if (!/(?:令和|平成)/.test(title)) continue;

    const url = `${BASE_ORIGIN}${href}`;
    if (seen.has(url)) continue;
    seen.add(url);

    links.push({ title, url });
  }

  return links;
}

export interface SessionLink {
  title: string;
  url: string;
  pageId: string;
}

/**
 * 年度別一覧ページ HTML から個別会議録ページのリンクを抽出する。
 * リンク形式: <a href="/soshiki/11/{記事ID}.html">令和X年第Y回（Z月）定例会</a>
 */
export function parseSessionLinks(html: string): SessionLink[] {
  const links: SessionLink[] = [];
  const seen = new Set<string>();

  const pattern = /<a\s[^>]*href="\/soshiki\/11\/(\d+)\.html"[^>]*>([^<]+)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pattern.exec(html)) !== null) {
    const pageId = m[1]!;
    const title = m[2]!.replace(/\s+/g, " ").trim();

    // 会議名（定例会・臨時会）のみ対象
    if (!title.includes("定例会") && !title.includes("臨時会")) continue;

    if (seen.has(pageId)) continue;
    seen.add(pageId);

    links.push({
      title,
      url: `${BASE_ORIGIN}/soshiki/11/${pageId}.html`,
      pageId,
    });
  }

  return links;
}

/**
 * 個別会議録ページ HTML から PDF リンクを抽出する。
 * PDF URL 形式: /uploaded/attachment/{ファイルID}.pdf
 */
export function parsePdfLinks(
  html: string,
  sessionTitle: string,
  pageId: string,
  _pageUrl: string
): KawaminamiPdfRecord[] {
  const records: KawaminamiPdfRecord[] = [];
  const meetingType = detectMeetingType(sessionTitle);

  const pdfPattern = /<a\s[^>]*href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([^<]*)<\/a>/gi;

  let m: RegExpExecArray | null;
  while ((m = pdfPattern.exec(html)) !== null) {
    const href = m[1]!;
    const linkText = m[2]!.replace(/\s+/g, " ").trim();

    const pdfUrl = `${BASE_ORIGIN}${href}`;

    records.push({
      title: sessionTitle,
      pageId,
      pageUrl: `${BASE_ORIGIN}/soshiki/11/${pageId}.html`,
      pdfUrl,
      pdfLabel: linkText,
      meetingType,
    });
  }

  return records;
}
