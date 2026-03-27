/**
 * 勝浦町議会 会議録 -- list フェーズ
 *
 * 会議録一覧ページから年度ページを収集し、
 * 対象年に該当する PDF リンクを取得する。
 *
 * 勝浦町は fiscal year ごとのページに 4月〜翌3月の会議録を掲載するため、
 * calendar year を組み立てるには前年度ページと当年度ページの両方を見る必要がある。
 */

import {
  LIST_PAGE_URL,
  collapseWhitespace,
  detectMeetingType,
  fetchPage,
  meetingCalendarYearFromFiscalYear,
  parseFiscalYearLabel,
  resolveUrl,
  toHalfWidth,
} from "./shared";

export interface KatsuuraFiscalYearPage {
  fiscalYear: number;
  url: string;
  label: string;
}

export interface KatsuuraMeeting {
  pdfUrl: string;
  title: string;
  pageUrl: string;
  fiscalYear: number;
  month: number;
  meetingType: string;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ");
}

/** 一覧ページから年度ページリンクを抽出する */
export function parseIndexPage(
  html: string,
  baseUrl = LIST_PAGE_URL,
): KatsuuraFiscalYearPage[] {
  const results: KatsuuraFiscalYearPage[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const label = collapseWhitespace(stripHtml(match[2] ?? ""));
    if (!label.includes("年度")) continue;
    if (!href.includes("/gikai/kaigiroku/")) continue;

    const fiscalYear = parseFiscalYearLabel(label);
    if (fiscalYear === null) continue;

    const url = resolveUrl(href, baseUrl);
    if (seen.has(url)) continue;
    seen.add(url);

    results.push({
      fiscalYear,
      url,
      label,
    });
  }

  return results.sort((a, b) => b.fiscalYear - a.fiscalYear);
}

/** リンクテキストを会議タイトルに整形する */
export function cleanLinkText(rawText: string): string {
  const normalized = collapseWhitespace(stripHtml(rawText));
  const withoutPdfSize = normalized.replace(/\[PDF[^\]]*\]/gi, "").trim();
  const duplicated = withoutPdfSize.match(/^(.+?)\s+\1$/);
  return duplicated ? duplicated[1]!.trim() : withoutPdfSize;
}

/** 会議タイトルから月を抽出する */
export function parseMeetingMonth(title: string): number | null {
  const normalized = toHalfWidth(title);
  const match = normalized.match(/(\d{1,2})月/);
  if (!match) return null;

  const month = Number(match[1]);
  if (month < 1 || month > 12) return null;
  return month;
}

/**
 * 年度ページから PDF リンクを抽出し、
 * 対象 calendar year に該当するものだけ返す。
 */
export function parseFiscalYearPage(
  html: string,
  fiscalYear: number,
  targetYear: number,
  pageUrl: string,
): KatsuuraMeeting[] {
  const results: KatsuuraMeeting[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const title = cleanLinkText(match[2] ?? "");
    if (!title) continue;

    const month = parseMeetingMonth(title);
    if (month === null) continue;

    const calendarYear = meetingCalendarYearFromFiscalYear(fiscalYear, month);
    if (calendarYear !== targetYear) continue;

    const pdfUrl = resolveUrl(href, pageUrl);
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    results.push({
      pdfUrl,
      title,
      pageUrl,
      fiscalYear,
      month,
      meetingType: detectMeetingType(title),
    });
  }

  return results.sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    return a.title.localeCompare(b.title, "ja");
  });
}

/** 指定年の会議一覧を取得する */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<KatsuuraMeeting[]> {
  const indexUrl = baseUrl || LIST_PAGE_URL;
  const indexHtml = await fetchPage(indexUrl);
  if (!indexHtml) return [];

  const fiscalYearPages = parseIndexPage(indexHtml, indexUrl).filter(
    (page) => year === page.fiscalYear || year === page.fiscalYear + 1,
  );

  const meetings: KatsuuraMeeting[] = [];
  const seen = new Set<string>();

  for (const page of fiscalYearPages) {
    const html = await fetchPage(page.url);
    if (!html) continue;

    const pageMeetings = parseFiscalYearPage(html, page.fiscalYear, year, page.url);
    for (const meeting of pageMeetings) {
      if (seen.has(meeting.pdfUrl)) continue;
      seen.add(meeting.pdfUrl);
      meetings.push(meeting);
    }
  }

  return meetings.sort((a, b) => {
    if (a.month !== b.month) return a.month - b.month;
    return a.title.localeCompare(b.title, "ja");
  });
}
