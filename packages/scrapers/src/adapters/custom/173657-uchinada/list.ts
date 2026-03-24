/**
 * 内灘町議会 — list フェーズ
 *
 * 本会議会議録・委員会等会議録の両方から PDF リンクを収集する。
 *
 * 本会議: 3階層構造
 *   インデックス（list99-130.html）
 *   └── 期間別一覧（site/gikai/*.html）× 5
 *       └── 会議録ページ（soshiki/gikai/*.html）× 会議ごと
 *           └── PDF（uploaded/attachment/*.pdf）× 開催日ごと
 *
 * 委員会: 4階層構造
 *   委員会インデックス（soshiki/gikai/12083.html）
 *   └── 委員会別ページ（soshiki/gikai/*.html）
 *       └── 年度別ページ（soshiki/gikai/*.html）
 *           └── PDF（uploaded/attachment/*.pdf）
 */

import { BASE_ORIGIN, eraToYear, fetchPage } from "./shared";

export interface UchinadaMeeting {
  pdfUrl: string;
  /** 会議録ページのタイトル（例: 令和6年内灘町議会12月会議会議録） */
  pageTitle: string;
  /** PDF リンクテキストから取得した内容名（例: 町政一般質問） */
  contentLabel: string;
  /** 開催日 YYYY-MM-DD 形式（【月日】から抽出） */
  heldOn: string | null;
  /** 対応する西暦年 */
  year: number;
  /** 会議録ページの URL */
  meetingPageUrl: string;
}

/**
 * 本会議インデックスページの期間別一覧ページ URL リスト。
 * インデックスページから動的取得するが、固定 URL も使用可能。
 */
export const PLENARY_PERIOD_URLS = [
  `${BASE_ORIGIN}/site/gikai/22389.html`, // 令和6年～
  `${BASE_ORIGIN}/site/gikai/22385.html`, // 令和3年～令和5年
  `${BASE_ORIGIN}/site/gikai/22382.html`, // 平成30年～令和2年
  `${BASE_ORIGIN}/site/gikai/22381.html`, // 平成27年～平成29年
  `${BASE_ORIGIN}/site/gikai/22380.html`, // 平成24年～平成26年
];

/** 委員会インデックスページ URL */
export const COMMITTEE_INDEX_URL = `${BASE_ORIGIN}/soshiki/gikai/12083.html`;

/**
 * ページタイトルから西暦年を抽出する。
 * 例: "令和6年内灘町議会12月会議会議録" -> 2024
 */
export function parseYearFromTitle(title: string): number | null {
  return eraToYear(title);
}

/**
 * PDF リンクテキストから内容ラベル（【月日】より前の部分）を取得する。
 * 例: "町政一般質問【12月5日】[PDFファイル／689KB]" -> "町政一般質問"
 */
export function parseContentLabel(linkText: string): string {
  // 【...】以降を除去
  const withoutDate = linkText.replace(/【[^】]*】.*/, "").trim();
  // [PDFファイル/...] を除去
  return withoutDate.replace(/\s*\[PDFファイル[^\]]*\]/g, "").trim();
}

/**
 * PDF リンクテキストから開催日（【月日】部分）を取得して、指定年と組み合わせて YYYY-MM-DD に変換する。
 * 例: "町政一般質問【12月5日】[PDFファイル／689KB]", year=2024 -> "2024-12-05"
 */
export function parseDateFromLinkText(
  linkText: string,
  year: number
): string | null {
  const match = linkText.match(/【(\d+)月(\d+)日】/);
  if (!match) return null;
  const month = String(parseInt(match[1]!, 10)).padStart(2, "0");
  const day = String(parseInt(match[2]!, 10)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 期間別一覧ページの HTML から会議録ページ URL を抽出する。
 * リンクパターン: /soshiki/gikai/{ID}.html
 */
export function parseMeetingPageUrls(html: string): string[] {
  const urls: string[] = [];
  const pattern = /<a[^>]+href="(\/soshiki\/gikai\/\d+\.html)"[^>]*>/gi;
  const seen = new Set<string>();
  for (const match of html.matchAll(pattern)) {
    const href = match[1]!;
    const url = `${BASE_ORIGIN}${href}`;
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

/**
 * 会議録ページの HTML から <h1> タイトルを取得する。
 */
export function parseMeetingPageTitle(html: string): string {
  const match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) return "";
  return match[1]!.replace(/<[^>]+>/g, "").trim();
}

/**
 * 会議録ページの HTML から PDF リンクを抽出する。
 * href パターン: /uploaded/attachment/{ID}.pdf
 */
export function parsePdfLinks(
  html: string,
  pageTitle: string,
  year: number,
  meetingPageUrl: string
): UchinadaMeeting[] {
  const results: UchinadaMeeting[] = [];

  const pattern =
    /<a[^>]+href="(\/uploaded\/attachment\/\d+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();
    if (!linkText) continue;

    const pdfUrl = `${BASE_ORIGIN}${href}`;
    const contentLabel = parseContentLabel(linkText);
    const heldOn = parseDateFromLinkText(linkText, year);

    results.push({
      pdfUrl,
      pageTitle,
      contentLabel,
      heldOn,
      year,
      meetingPageUrl,
    });
  }

  return results;
}

/**
 * 指定年の会議録メタ情報をすべて取得する。
 *
 * targetYear が 0 の場合は全件取得。
 * それ以外は指定年のみ返す（会議録ページのタイトルから年を判定）。
 */
export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<UchinadaMeeting[]> {
  const allMeetings: UchinadaMeeting[] = [];
  const seenPdfUrls = new Set<string>();

  // === 本会議会議録 ===
  // 期間別一覧ページの URL を取得（インデックスページから動的に取得 or 固定 URL）
  const periodUrls = await fetchPeriodUrls(baseUrl);

  for (const periodUrl of periodUrls) {
    const periodHtml = await fetchPage(periodUrl);
    if (!periodHtml) continue;

    const meetingPageUrls = parseMeetingPageUrls(periodHtml);

    for (const meetingPageUrl of meetingPageUrls) {
      const meetingHtml = await fetchPage(meetingPageUrl);
      if (!meetingHtml) continue;

      const pageTitle = parseMeetingPageTitle(meetingHtml);
      const pageYear = parseYearFromTitle(pageTitle);
      if (pageYear === null) continue;
      if (year !== 0 && pageYear !== year) continue;

      const meetings = parsePdfLinks(
        meetingHtml,
        pageTitle,
        pageYear,
        meetingPageUrl
      );

      for (const m of meetings) {
        if (!seenPdfUrls.has(m.pdfUrl)) {
          seenPdfUrls.add(m.pdfUrl);
          allMeetings.push(m);
        }
      }
    }
  }

  // === 委員会等会議録 ===
  const committeeMeetings = await fetchCommitteeMeetings(year, seenPdfUrls);
  allMeetings.push(...committeeMeetings);

  return allMeetings;
}

/**
 * インデックスページから期間別一覧ページ URL を取得する。
 * 失敗した場合は固定 URL を返す。
 */
async function fetchPeriodUrls(indexUrl: string): Promise<string[]> {
  const html = await fetchPage(indexUrl);
  if (!html) return PLENARY_PERIOD_URLS;

  // インデックスページから site/gikai/*.html へのリンクを抽出
  const pattern = /<a[^>]+href="(\/site\/gikai\/\d+\.html)"[^>]*>/gi;
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const match of html.matchAll(pattern)) {
    const url = `${BASE_ORIGIN}${match[1]!}`;
    if (!seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }

  return urls.length > 0 ? urls : PLENARY_PERIOD_URLS;
}

/**
 * 委員会等会議録のすべての PDF リンクを取得する。
 *
 * 4階層: 委員会インデックス -> 委員会別 -> 年度別 -> PDF
 */
async function fetchCommitteeMeetings(
  targetYear: number,
  seenPdfUrls: Set<string>
): Promise<UchinadaMeeting[]> {
  const allMeetings: UchinadaMeeting[] = [];

  const indexHtml = await fetchPage(COMMITTEE_INDEX_URL);
  if (!indexHtml) return allMeetings;

  // 委員会別ページ URL を取得
  const committeeUrls = parseMeetingPageUrls(indexHtml);

  for (const committeeUrl of committeeUrls) {
    const committeeHtml = await fetchPage(committeeUrl);
    if (!committeeHtml) continue;

    // 委員会別ページから年度別ページ URL を取得
    const yearPageUrls = parseMeetingPageUrls(committeeHtml);

    for (const yearPageUrl of yearPageUrls) {
      const yearPageHtml = await fetchPage(yearPageUrl);
      if (!yearPageHtml) continue;

      const pageTitle = parseMeetingPageTitle(yearPageHtml);
      const pageYear = parseYearFromTitle(pageTitle);
      if (pageYear === null) continue;
      if (targetYear !== 0 && pageYear !== targetYear) continue;

      const meetings = parsePdfLinks(
        yearPageHtml,
        pageTitle,
        pageYear,
        yearPageUrl
      );

      for (const m of meetings) {
        if (!seenPdfUrls.has(m.pdfUrl)) {
          seenPdfUrls.add(m.pdfUrl);
          allMeetings.push(m);
        }
      }
    }
  }

  return allMeetings;
}
