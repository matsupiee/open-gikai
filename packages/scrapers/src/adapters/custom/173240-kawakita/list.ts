/**
 * 川北町議会 会議録 -- list フェーズ
 *
 * 一覧ページの年セクションから会期見出しを取得し、
 * 各会期配下の PDF から本文のみを抽出する。
 */

import {
  LIST_PAGE_URL,
  collapseWhitespace,
  detectMeetingType,
  fetchPage,
  parseJapaneseDate,
  parseWarekiYear,
  resolveUrl,
} from "./shared";

export interface KawakitaMeeting {
  pdfUrl: string;
  title: string;
  sessionTitle: string;
  meetingType: string;
  heldOnHint: string | null;
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ");
}

function cleanText(text: string): string {
  return collapseWhitespace(stripHtml(text));
}

export function parseYearSections(
  html: string,
): Array<{ year: number; sectionHtml: string }> {
  const sections: Array<{ year: number; sectionHtml: string }> = [];
  const headingRegex = /<h4[^>]*class="h4"[^>]*>([\s\S]*?)<\/h4>/gi;
  const matches = Array.from(html.matchAll(headingRegex));

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const headingText = cleanText(match[1] ?? "");
    const year = parseWarekiYear(headingText);
    if (year === null) continue;

    const start = match.index! + match[0].length;
    const end = matches[i + 1]?.index ?? html.length;
    sections.push({
      year,
      sectionHtml: html.slice(start, end),
    });
  }

  return sections;
}

export function parseYearSection(
  sectionHtml: string,
  baseUrl = LIST_PAGE_URL,
): KawakitaMeeting[] {
  const meetings: KawakitaMeeting[] = [];
  const sessionRegex =
    /<table[^>]*table-xs-list[^>]*>[\s\S]*?<td>([\s\S]*?)<\/td>[\s\S]*?<\/table>/gi;
  const sessionMatches = Array.from(sectionHtml.matchAll(sessionRegex));

  for (let i = 0; i < sessionMatches.length; i++) {
    const sessionMatch = sessionMatches[i]!;
    const sessionTitle = cleanText(sessionMatch[1] ?? "");
    if (!sessionTitle) continue;

    const blockStart = sessionMatch.index! + sessionMatch[0].length;
    const blockEnd = sessionMatches[i + 1]?.index ?? sectionHtml.length;
    const blockHtml = sectionHtml.slice(blockStart, blockEnd);

    const fileRegex =
      /<a[^>]+href="([^"]+\.pdf[^"]*)"[^>]*>[\s\S]*?<p[^>]*class="caption file-name"[^>]*>([\s\S]*?)<\/p>[\s\S]*?<\/a>/gi;

    for (const fileMatch of blockHtml.matchAll(fileRegex)) {
      const href = fileMatch[1]!;
      const caption = cleanText(fileMatch[2] ?? "");
      if (!caption.includes("本文")) continue;

      meetings.push({
        pdfUrl: resolveUrl(href, baseUrl),
        title: `${sessionTitle} ${caption}`,
        sessionTitle,
        meetingType: detectMeetingType(sessionTitle),
        heldOnHint: parseJapaneseDate(caption),
      });
    }
  }

  return meetings;
}

export function parseListPage(html: string, targetYear: number): KawakitaMeeting[] {
  const yearSection = parseYearSections(html).find((section) => section.year === targetYear);
  if (!yearSection) return [];
  return parseYearSection(yearSection.sectionHtml);
}

export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<KawakitaMeeting[]> {
  const html = await fetchPage(baseUrl || LIST_PAGE_URL);
  if (!html) return [];
  return parseListPage(html, year);
}
