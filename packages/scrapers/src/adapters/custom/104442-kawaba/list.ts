/**
 * 川場村議会 会議録 -- list フェーズ
 *
 * 一覧ページの h3 見出しごとに会期ブロックを抽出し、
 * PDF 会議録リンクから指定年の会議一覧を返す。
 */

import {
  LIST_PAGE_URL,
  collapseWhitespace,
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  resolveUrl,
  toHalfWidth,
} from "./shared";

export interface KawabaMeeting {
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

/** section 見出しとリンクリストのペアを抽出する */
export function parseSections(
  html: string,
): Array<{ sessionTitle: string; listHtml: string }> {
  const sections: Array<{ sessionTitle: string; listHtml: string }> = [];
  const sectionPattern =
    /<h3[^>]*>([\s\S]*?)<\/h3>\s*<ul[^>]*class="list-base"[^>]*>([\s\S]*?)<\/ul>/gi;

  for (const match of html.matchAll(sectionPattern)) {
    const sessionTitle = cleanText(match[1] ?? "");
    const listHtml = match[2] ?? "";
    if (!sessionTitle) continue;
    sections.push({ sessionTitle, listHtml });
  }

  return sections;
}

/** リンクテキストから開催日ヒントを取得する */
export function parseHeldOnHint(
  sessionTitle: string,
  linkText: string,
): string | null {
  const year = parseWarekiYear(sessionTitle);
  if (year === null) return null;

  const normalized = toHalfWidth(linkText);
  const match = normalized.match(/[（(]\s*(\d{1,2})月(\d{1,2})日[）)]/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 1 セクションの PDF リンクを抽出する */
export function parseSectionLinks(
  sessionTitle: string,
  listHtml: string,
  baseUrl = LIST_PAGE_URL,
): KawabaMeeting[] {
  const meetings: KawabaMeeting[] = [];
  const normalizedSessionTitle = collapseWhitespace(sessionTitle);
  const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of listHtml.matchAll(linkPattern)) {
    const href = match[1]!;
    const linkText = cleanText(match[2] ?? "");
    if (!linkText) continue;
    if (linkText.includes("目次") || linkText.includes("議会会議録")) continue;

    const title = `${normalizedSessionTitle} ${linkText}`;
    meetings.push({
      pdfUrl: resolveUrl(href, baseUrl),
      title,
      sessionTitle: normalizedSessionTitle,
      meetingType: detectMeetingType(normalizedSessionTitle),
      heldOnHint: parseHeldOnHint(normalizedSessionTitle, linkText),
    });
  }

  return meetings;
}

/** 一覧ページ全体から指定年の会議一覧を抽出する */
export function parseListPage(html: string, year: number): KawabaMeeting[] {
  const meetings: KawabaMeeting[] = [];

  for (const section of parseSections(html)) {
    const sessionYear = parseWarekiYear(section.sessionTitle);
    if (sessionYear !== year) continue;
    meetings.push(...parseSectionLinks(section.sessionTitle, section.listHtml));
  }

  return meetings;
}

export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<KawabaMeeting[]> {
  const html = await fetchPage(baseUrl || LIST_PAGE_URL);
  if (!html) return [];
  return parseListPage(html, year);
}
