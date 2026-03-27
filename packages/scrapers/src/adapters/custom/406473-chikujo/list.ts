/**
 * 築上町議会 — list フェーズ
 *
 * 3段階で PDF リンクを収集する:
 * 1. トップページから年度ページリンクを抽出
 * 2. 年度ページから会議ページリンクを抽出
 * 3. 会議ページから各開催日の PDF リンクを抽出
 */

import {
  detectMeetingType,
  fetchPage,
  parseDateText,
  parseWarekiYear,
  toAbsoluteUrl,
} from "./shared";

export interface ChikujoMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  meetingType: string;
  pageUrl: string;
}

interface YearPageLink {
  title: string;
  year: number;
  yearPageUrl: string;
}

interface MeetingPageLink {
  title: string;
  pageUrl: string;
}

/**
 * トップページから年度ページリンクを抽出する。
 */
export function parseTopPage(html: string, topPageUrl: string): YearPageLink[] {
  const results: YearPageLink[] = [];
  const seen = new Set<string>();
  const linkRegex = /<a[^>]+href="([^"]+\/index\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const title = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const year = parseWarekiYear(title);
    if (!year) continue;

    const yearPageUrl = toAbsoluteUrl(href, topPageUrl);
    if (seen.has(yearPageUrl)) continue;
    seen.add(yearPageUrl);

    results.push({ title, year, yearPageUrl });
  }

  return results;
}

/**
 * 年度ページから会議ページリンクを抽出する。
 */
export function parseYearPage(
  html: string,
  yearPageUrl: string,
): MeetingPageLink[] {
  const results: MeetingPageLink[] = [];
  const seen = new Set<string>();
  const linkRegex = /<a[^>]+href="([^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const title = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

    if (
      !title.includes("定例会") &&
      !title.includes("臨時会") &&
      !title.includes("委員会")
    ) {
      continue;
    }

    if (href.endsWith("/index.html")) continue;

    const pageUrl = toAbsoluteUrl(href, yearPageUrl);
    if (seen.has(pageUrl)) continue;
    seen.add(pageUrl);

    results.push({ title, pageUrl });
  }

  return results;
}

/**
 * 会議ページから PDF リンクを抽出する。
 */
export function parseMeetingPage(
  html: string,
  meetingTitle: string,
  pageUrl: string,
): ChikujoMeeting[] {
  const results: ChikujoMeeting[] = [];
  const seen = new Set<string>();
  const meetingType = detectMeetingType(meetingTitle);
  const linkRegex = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const heldOn = parseDateText(linkText);
    if (!heldOn) continue;

    const pdfUrl = toAbsoluteUrl(href, pageUrl);
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

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
): Promise<ChikujoMeeting[]> {
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml, baseUrl).filter((entry) => entry.year === year);
  if (yearPages.length === 0) return [];

  const meetings: ChikujoMeeting[] = [];

  for (const yearPage of yearPages) {
    const yearHtml = await fetchPage(yearPage.yearPageUrl);
    if (!yearHtml) continue;

    const meetingPages = parseYearPage(yearHtml, yearPage.yearPageUrl);
    for (let i = 0; i < meetingPages.length; i++) {
      const meetingPage = meetingPages[i]!;
      const detailHtml = await fetchPage(meetingPage.pageUrl);
      if (!detailHtml) continue;

      meetings.push(...parseMeetingPage(detailHtml, meetingPage.title, meetingPage.pageUrl));

      if (i < meetingPages.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
      }
    }
  }

  return meetings;
}
