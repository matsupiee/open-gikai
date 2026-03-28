/**
 * 福智町議会 — list フェーズ
 *
 * 一覧ページは単一ページ構成で、年度見出しごとに PDF リンクが並ぶ。
 */

import {
  detectMeetingType,
  eraToWesternYear,
  fetchPage,
  toAbsoluteUrl,
} from "./shared";

export interface FukuchiMeeting {
  pdfUrl: string;
  title: string;
  meetingType: string;
}

interface ParsedListRecord extends FukuchiMeeting {
  year: number;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function parseListPage(html: string): ParsedListRecord[] {
  const results: ParsedListRecord[] = [];

  const sectionRegex =
    /<h2[^>]*class="head-title"[^>]*>[\s\S]*?<span class="bg2">\s*([^<]+?)\s*<\/span>[\s\S]*?<\/h2>\s*<div class="wysiwyg">([\s\S]*?)<\/div>/gi;

  for (const match of html.matchAll(sectionRegex)) {
    const yearLabel = stripHtml(match[1]!);
    const year = eraToWesternYear(yearLabel);
    if (!year) continue;

    const sectionHtml = match[2]!;
    const paragraphRegex = /<p>([\s\S]*?)<\/p>/gi;

    for (const paragraphMatch of sectionHtml.matchAll(paragraphRegex)) {
      const paragraphHtml = paragraphMatch[1]!;
      const hrefMatch = paragraphHtml.match(/href="([^"]+\.pdf)"/i);
      if (!hrefMatch) continue;

      const title = stripHtml(paragraphHtml)
        .replace(/[（(]\s*PDF\s*ファイ\s*ル:[^）)]*[）)]?/gi, "")
        .trim();

      if (!title.includes("議事録")) continue;

      results.push({
        year,
        pdfUrl: toAbsoluteUrl(hrefMatch[1]!),
        title,
        meetingType: detectMeetingType(title),
      });
    }
  }

  return results;
}

export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<FukuchiMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseListPage(html)
    .filter((meeting) => meeting.year === year)
    .map(({ year: _year, ...meeting }) => meeting);
}
