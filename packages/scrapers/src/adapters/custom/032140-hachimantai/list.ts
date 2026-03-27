/**
 * 八幡平市議会 -- list フェーズ
 *
 * 会議録トップページから年度別ページを特定し、
 * 年度別ページから会議種別ごとの frameset HTML をたどり、
 * 目次ページから日別本文 HTML を列挙する。
 */

import {
  LIST_URL,
  buildAbsoluteUrl,
  detectMeetingType,
  fetchShiftJisPage,
  fetchUtf8Page,
  normalizeText,
  parseMonthDay,
  parseWarekiYear,
} from "./shared";

export interface HachimantaiMeeting {
  title: string;
  heldOn: string;
  mainUrl: string;
  meetingType: "plenary" | "committee" | "extraordinary";
}

interface YearPageLink {
  title: string;
  url: string;
  year: number;
}

interface SessionLink {
  title: string;
  url: string;
}

interface SessionFrameset {
  sessionTitle: string;
  indexUrl: string;
}

/** トップページから年度別ページリンクを抽出する */
export function parseYearPageLinks(html: string): YearPageLink[] {
  const results: YearPageLink[] = [];
  const seen = new Set<string>();
  const linkPattern =
    /<a[^>]+href="(\/site\/gikai\/\d+\.html)"[^>]*>([\s\S]*?会議録[\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const url = buildAbsoluteUrl(match[1]!);
    if (seen.has(url)) continue;

    const title = normalizeText(match[2]!.replace(/<[^>]+>/g, ""));
    const year = parseWarekiYear(title);
    if (!year) continue;

    seen.add(url);
    results.push({ title, url, year });
  }

  return results;
}

/** 年度別ページから会議ごとの frameset リンクを抽出する */
export function parseMeetingLinks(html: string, pageUrl: string): SessionLink[] {
  const results: SessionLink[] = [];
  const seen = new Set<string>();
  const listPattern =
    /<li>\s*<a[^>]+href="([^"]*\/shigikai\/kaigiroku\/[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi;

  for (const match of html.matchAll(listPattern)) {
    const url = buildAbsoluteUrl(match[1]!, pageUrl);
    if (seen.has(url)) continue;

    const title = normalizeText(match[2]!.replace(/<[^>]+>/g, ""));
    if (!title) continue;

    seen.add(url);
    results.push({ title, url });
  }

  return results;
}

/** frameset HTML から会議タイトルと目次 URL を抽出する */
export function parseSessionFrameset(
  html: string,
  framesetUrl: string,
): SessionFrameset | null {
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/i);
  const indexMatch = html.match(
    /<frame[^>]+name="index"[^>]+src="([^"]+\.html)"/i,
  );

  if (!titleMatch || !indexMatch) return null;

  const sessionTitle = normalizeText(titleMatch[1]!);
  if (!sessionTitle) return null;

  return {
    sessionTitle,
    indexUrl: buildAbsoluteUrl(indexMatch[1]!, framesetUrl),
  };
}

/** 目次ページから日別本文 HTML を抽出する */
export function parseIndexPage(
  html: string,
  indexUrl: string,
  sessionTitle: string,
  year: number,
): HachimantaiMeeting[] {
  const results: HachimantaiMeeting[] = [];
  const seen = new Set<string>();
  const linkPattern = /<a[^>]+href="([^"#]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const mainUrl = buildAbsoluteUrl(match[1]!, indexUrl);
    if (seen.has(mainUrl)) continue;

    const rawTitle = normalizeText(match[2]!.replace(/<[^>]+>/g, ""));
    const pageTitle = rawTitle.replace(/\s+/g, "");
    if (!/^第\d+号（\d{1,2}月\d{1,2}日）$/.test(pageTitle)) continue;

    const heldOn = parseMonthDay(pageTitle, year);
    if (!heldOn) continue;

    seen.add(mainUrl);
    results.push({
      title: `${sessionTitle} ${pageTitle}`,
      heldOn,
      mainUrl,
      meetingType: detectMeetingType(sessionTitle),
    });
  }

  return results;
}

/** 指定年の本文 HTML 一覧を取得する */
export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<HachimantaiMeeting[]> {
  const topHtml = await fetchUtf8Page(baseUrl || LIST_URL);
  if (!topHtml) return [];

  const yearPage = parseYearPageLinks(topHtml).find((entry) => entry.year === year);
  if (!yearPage) return [];

  const yearHtml = await fetchUtf8Page(yearPage.url);
  if (!yearHtml) return [];

  const sessionLinks = parseMeetingLinks(yearHtml, yearPage.url);
  const results: HachimantaiMeeting[] = [];
  const seen = new Set<string>();

  for (const sessionLink of sessionLinks) {
    const framesetHtml = await fetchShiftJisPage(sessionLink.url);
    if (!framesetHtml) continue;

    const frameset = parseSessionFrameset(framesetHtml, sessionLink.url);
    if (!frameset) continue;

    const indexHtml = await fetchShiftJisPage(frameset.indexUrl);
    if (!indexHtml) continue;

    const meetings = parseIndexPage(
      indexHtml,
      frameset.indexUrl,
      frameset.sessionTitle,
      year,
    );

    for (const meeting of meetings) {
      if (seen.has(meeting.mainUrl)) continue;
      seen.add(meeting.mainUrl);
      results.push(meeting);
    }
  }

  return results;
}
