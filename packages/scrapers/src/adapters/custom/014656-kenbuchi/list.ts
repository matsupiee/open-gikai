/**
 * 剣淵町議会 会議録（議決結果）-- list フェーズ
 *
 * 単一ページの年度別一覧から議決結果 PDF を収集する。
 */

import {
  BASE_ORIGIN,
  LIST_URL,
  compactJapaneseText,
  detectMeetingType,
  eraToWesternYear,
  fetchPage,
  normalizeWhitespace,
  stripTags,
  toHalfWidth,
} from "./shared";

export interface KenbuchiMeeting {
  title: string;
  pdfUrl: string;
  meetingType: string;
  year: number;
  dateText: string;
}

export function resolvePdfUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
}

export function parseHeadingYear(text: string): { year: number; eraLabel: string } | null {
  const normalized = normalizeWhitespace(toHalfWidth(text));
  const match = normalized.match(/(令和|平成)\s*(元|\d+)\s*年\s*開催/);
  if (!match) return null;

  const year = eraToWesternYear(match[1]!, match[2]!);
  if (!year) return null;

  return {
    year,
    eraLabel: `${match[1]}${match[2] === "元" ? "元" : Number(match[2]!)}年`,
  };
}

export function parseMeetingLink(
  linkText: string,
  yearInfo: { year: number; eraLabel: string } | null,
): Omit<KenbuchiMeeting, "pdfUrl"> | null {
  if (!yearInfo) return null;

  const normalized = normalizeWhitespace(toHalfWidth(linkText)).replace(/^→\s*/, "");
  const dateMatch = normalized.match(/[（(]([^）)]+)[）)]/);
  const dateText = dateMatch?.[1] ? compactJapaneseText(dateMatch[1]) : "";
  const bareTitle = normalized
    .replace(/[（(][^）)]*[）)]/, "")
    .replace(/\s+/g, "")
    .trim();

  if (!bareTitle || !dateText) return null;

  const title = /^(令和|平成)/.test(bareTitle) ? bareTitle : `${yearInfo.eraLabel}${bareTitle}`;

  return {
    title,
    meetingType: detectMeetingType(title),
    year: yearInfo.year,
    dateText,
  };
}

export function parseListPage(html: string): KenbuchiMeeting[] {
  const meetings: KenbuchiMeeting[] = [];
  let currentYear: { year: number; eraLabel: string } | null = null;
  const seen = new Set<string>();

  for (const match of html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    const innerHtml = match[1]!;
    const paragraphText = stripTags(innerHtml);

    const yearInfo = parseHeadingYear(paragraphText);
    if (yearInfo) {
      currentYear = yearInfo;
      continue;
    }

    for (const linkMatch of innerHtml.matchAll(
      /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi,
    )) {
      const href = linkMatch[1]!;
      const rawLinkText = stripTags(linkMatch[2]!);
      const parsed = parseMeetingLink(rawLinkText, currentYear);
      if (!parsed) continue;

      const pdfUrl = resolvePdfUrl(href);
      if (seen.has(pdfUrl)) continue;
      seen.add(pdfUrl);

      meetings.push({
        ...parsed,
        pdfUrl,
      });
    }
  }

  return meetings;
}

export async function fetchMeetingList(year: number): Promise<KenbuchiMeeting[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  return parseListPage(html).filter((meeting) => meeting.year === year);
}
