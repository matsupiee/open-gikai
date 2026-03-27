/**
 * 朝倉市議会（福岡県） — list フェーズ
 *
 * 3段階で PDF リンクを収集する:
 * 1. トップページから年度ページを抽出
 * 2. 年度ページから会議詳細ページを抽出
 * 3. 会議詳細ページから日別 PDF リンクを抽出
 */

import {
  detectMeetingType,
  fetchPage,
  parseDateText,
  parseMonthDayText,
  parseWarekiYear,
  toAbsoluteUrl,
  toJapaneseEraLabels,
} from "./shared";

export interface AsakuraMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  meetingType: "plenary" | "extraordinary" | "committee";
  pageUrl: string;
}

export interface YearPageLink {
  label: string;
  url: string;
}

export interface MeetingPageLink {
  title: string;
  url: string;
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function cleanPdfLabel(text: string): string {
  return stripTags(text)
    .replace(/\s*（PDF[^）]*）/g, "")
    .replace(/\s*\(PDF[^)]*\)/g, "")
    .replace(/\s*（(?:令和|平成)[^）]*）/g, "")
    .trim();
}

function isMeetingPageTitle(text: string): boolean {
  return (
    text.includes("定例会") ||
    text.includes("臨時会") ||
    text.includes("委員会") ||
    text.includes("全員協議会")
  );
}

function shouldSkipPdfLabel(text: string): boolean {
  return (
    text.includes("会期日程表") ||
    text.includes("一般質問通告書") ||
    text.includes("議事日程表") ||
    text.includes("資料") ||
    text.includes("一覧表")
  );
}

function buildDetailTitle(meetingTitle: string, label: string): string {
  if (!label) return meetingTitle;
  if (label === meetingTitle || label.includes(meetingTitle)) return label;
  return `${meetingTitle} ${label}`.trim();
}

export function parseTopPage(html: string, pageUrl: string): YearPageLink[] {
  const results: YearPageLink[] = [];
  const seen = new Set<string>();
  const linkRegex =
    /<a[^>]+href="([^"]*\/www\/contents\/\d+\/index\.html|\/www\/contents\/\d+\/index\.html|https?:\/\/[^"]*\/www\/contents\/\d+\/index\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const label = stripTags(match[2]!);
    if (!label || (!label.includes("令和") && !label.includes("平成"))) continue;

    const url = toAbsoluteUrl(href, pageUrl);
    if (seen.has(url)) continue;
    seen.add(url);
    results.push({ label, url });
  }

  return results;
}

export function parseMeetingLinks(
  html: string,
  pageUrl: string,
): MeetingPageLink[] {
  const results: MeetingPageLink[] = [];
  const seen = new Set<string>();
  const linkRegex =
    /<a[^>]+href="([^"]*\/www\/contents\/\d+\/index\.html|\/www\/contents\/\d+\/index\.html|https?:\/\/[^"]*\/www\/contents\/\d+\/index\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1]!;
    const title = stripTags(match[2]!);
    if (!isMeetingPageTitle(title)) continue;

    const url = toAbsoluteUrl(href, pageUrl);
    if (url === pageUrl || seen.has(url)) continue;
    seen.add(url);
    results.push({ title, url });
  }

  return results;
}

export function parseDetailPage(
  html: string,
  meetingTitle: string,
  pageUrl: string,
): AsakuraMeeting[] {
  const results: AsakuraMeeting[] = [];
  const seen = new Set<string>();
  const meetingType = detectMeetingType(meetingTitle);
  const year = parseWarekiYear(meetingTitle);
  const pdfRegex = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pdfRegex)) {
    const href = match[1]!;
    const rawText = match[2]!;
    const rawLabel = stripTags(rawText)
      .replace(/\s*（PDF[^）]*）/g, "")
      .replace(/\s*\(PDF[^)]*\)/g, "")
      .trim();
    const label = cleanPdfLabel(rawText);
    if (!label || shouldSkipPdfLabel(label)) continue;

    const heldOn =
      parseDateText(rawLabel) ??
      (year ? parseMonthDayText(rawLabel, year) : null);
    if (!heldOn) continue;

    const pdfUrl = toAbsoluteUrl(href, pageUrl);
    if (seen.has(pdfUrl)) continue;
    seen.add(pdfUrl);

    results.push({
      pdfUrl,
      title: buildDetailTitle(meetingTitle, label),
      heldOn,
      meetingType,
      pageUrl,
    });
  }

  return results;
}

export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<AsakuraMeeting[]> {
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const targetEraLabels = toJapaneseEraLabels(year);
  const yearPages = parseTopPage(topHtml, baseUrl).filter((page) =>
    targetEraLabels.some((label) => page.label.includes(label)),
  );
  if (yearPages.length === 0) return [];

  const allMeetings: AsakuraMeeting[] = [];
  const seenPdfUrls = new Set<string>();

  for (const yearPage of yearPages) {
    const yearHtml = await fetchPage(yearPage.url);
    if (!yearHtml) continue;

    const meetingPages = parseMeetingLinks(yearHtml, yearPage.url);

    // 一部年度ページがそのまま PDF 一覧の可能性もあるためフォールバックを用意する。
    if (meetingPages.length === 0) {
      const directMeetings = parseDetailPage(yearHtml, yearPage.label, yearPage.url);
      for (const meeting of directMeetings) {
        if (seenPdfUrls.has(meeting.pdfUrl)) continue;
        seenPdfUrls.add(meeting.pdfUrl);
        allMeetings.push(meeting);
      }
      continue;
    }

    for (const meetingPage of meetingPages) {
      const detailHtml = await fetchPage(meetingPage.url);
      if (!detailHtml) continue;

      const meetings = parseDetailPage(
        detailHtml,
        meetingPage.title,
        meetingPage.url,
      );

      for (const meeting of meetings) {
        if (seenPdfUrls.has(meeting.pdfUrl)) continue;
        seenPdfUrls.add(meeting.pdfUrl);
        allMeetings.push(meeting);
      }
    }
  }

  return allMeetings;
}
