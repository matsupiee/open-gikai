/**
 * 奄美市議会 会議録 — list フェーズ
 *
 * 単一年度一覧ページから会議録を抽出する。
 * 例外ケース:
 * - 平成22年: 1会議が複数 PDF に分割されている
 * - 令和2年第2回定例会: 別 HTML ページに 8 PDF が分割掲載されている
 */

import {
  buildDocumentUrl,
  buildListUrl,
  delay,
  extractWesternYear,
  fetchPage,
  normalizeFullWidth,
} from "./shared";

const FILE_SIZE_PATTERN = /[（(]\s*PDF[：:][\s\S]*?[）)]/gi;
const SPLIT_NOTE_PATTERN = /[（(]\s*\d+\s*つのファイルに分割されております\s*[）)]/g;
const INTER_PAGE_DELAY_MS = 1_000;

export interface ParsedAmamiMeeting {
  title: string;
  year: number;
  pdfUrls: string[];
  detailPageUrl: string | null;
}

export interface AmamiMeeting {
  title: string;
  pdfUrls: string[];
  pageUrl: string;
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, " ");
}

export function cleanTitle(text: string): string {
  return normalizeFullWidth(stripTags(text))
    .replace(FILE_SIZE_PATTERN, "")
    .replace(SPLIT_NOTE_PATTERN, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dedupeUrls(urls: string[]): string[] {
  return Array.from(new Set(urls));
}

function parseAnchors(html: string, currentUrl: string): { url: string; text: string }[] {
  const anchors: { url: string; text: string }[] = [];
  const pattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const href = match[1]!;
    const text = cleanTitle(match[2]!);
    if (!text) continue;
    anchors.push({
      url: buildDocumentUrl(href, currentUrl),
      text,
    });
  }

  return anchors;
}

/**
 * 単一の li ブロックから 1 会議分の情報を抽出する。
 */
export function parseListItem(
  liHtml: string,
  currentUrl: string,
  year: number,
): ParsedAmamiMeeting | null {
  const anchors = parseAnchors(liHtml, currentUrl);
  if (anchors.length === 0) return null;

  const leadingRaw = liHtml.split(/<a\b/i)[0] ?? "";
  const leadingText = cleanTitle(leadingRaw);

  const pdfUrls = dedupeUrls(
    anchors.filter((a) => a.url.toLowerCase().endsWith(".pdf")).map((a) => a.url),
  );
  const detailPageUrl = anchors.find((a) => a.url.toLowerCase().endsWith(".html"))?.url ?? null;

  const titleSource = leadingText && pdfUrls.length > 1 ? leadingText : anchors[0]!.text;
  const title = cleanTitle(titleSource);
  if (!title) return null;

  return {
    title,
    year,
    pdfUrls,
    detailPageUrl,
  };
}

/**
 * 一覧ページ HTML から会議一覧を抽出する。
 */
export function parseListPage(
  html: string,
  listUrl: string,
  targetYear: number | null = null,
): ParsedAmamiMeeting[] {
  const meetings: ParsedAmamiMeeting[] = [];
  const sectionPattern = /<h2[^>]*>([\s\S]*?)<\/h2>\s*<ul[^>]*>([\s\S]*?)<\/ul>/gi;

  for (const sectionMatch of html.matchAll(sectionPattern)) {
    const headingText = cleanTitle(sectionMatch[1]!);
    const year = extractWesternYear(headingText);
    if (!year) continue;
    if (targetYear !== null && year !== targetYear) continue;

    const ulHtml = sectionMatch[2]!;
    const liPattern = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    for (const liMatch of ulHtml.matchAll(liPattern)) {
      const meeting = parseListItem(liMatch[1]!, listUrl, year);
      if (meeting) meetings.push(meeting);
    }
  }

  return meetings;
}

/**
 * 分割詳細ページから PDF リンクを抽出する。
 */
export function parseDetailPage(html: string, pageUrl: string): string[] {
  const anchors = parseAnchors(html, pageUrl);
  return dedupeUrls(anchors.map((a) => a.url).filter((url) => url.toLowerCase().endsWith(".pdf")));
}

/**
 * 指定年度の会議一覧を取得する。
 */
export async function fetchMeetingList(baseUrl: string, year: number): Promise<AmamiMeeting[]> {
  const listUrl = buildListUrl(baseUrl);
  const html = await fetchPage(listUrl);
  if (!html) return [];

  const parsed = parseListPage(html, listUrl, year);
  const meetings: AmamiMeeting[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const meeting = parsed[i]!;
    let pdfUrls = meeting.pdfUrls;
    let pageUrl = meeting.detailPageUrl ?? listUrl;

    if (meeting.detailPageUrl && pdfUrls.length === 0) {
      const detailHtml = await fetchPage(meeting.detailPageUrl);
      if (detailHtml) {
        pdfUrls = parseDetailPage(detailHtml, meeting.detailPageUrl);
      }
      pageUrl = meeting.detailPageUrl;

      if (i < parsed.length - 1) {
        await delay(INTER_PAGE_DELAY_MS);
      }
    } else if (pdfUrls.length === 1) {
      pageUrl = pdfUrls[0]!;
    }

    if (pdfUrls.length === 0) continue;

    meetings.push({
      title: meeting.title,
      pdfUrls,
      pageUrl,
    });
  }

  return meetings;
}
