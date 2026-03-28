import {
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  toAbsoluteUrl,
} from "./shared";

export interface ChikuzenYearPage {
  label: string;
  year: number;
  url: string;
}

export interface ChikuzenMeeting {
  title: string;
  detailUrl: string;
  year: number;
  meetingType: "plenary" | "extraordinary" | "committee";
}

function cleanText(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMenuSection(html: string): string {
  const match = html.match(
    /<div class="menu_section">([\s\S]*?)<\/div>\s*(?:<div|<\/div>)/i,
  );
  return match?.[1] ?? html;
}

export function parseTopPage(html: string, baseUrl: string): ChikuzenYearPage[] {
  const section = extractMenuSection(html);
  const pages: ChikuzenYearPage[] = [];
  const seen = new Set<string>();
  const pattern = /<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of section.matchAll(pattern)) {
    const href = match[1]!;
    const label = cleanText(match[2]!);
    const year = parseWarekiYear(label);
    if (year === null) continue;

    const url = toAbsoluteUrl(href, baseUrl);
    if (seen.has(url)) continue;
    seen.add(url);

    pages.push({ label, year, url });
  }

  return pages;
}

export function parseYearPage(
  html: string,
  pageUrl: string,
  year: number,
): ChikuzenMeeting[] {
  const section = extractMenuSection(html);
  const meetings: ChikuzenMeeting[] = [];
  const seen = new Set<string>();
  const pattern = /<a\s[^>]*href="([^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of section.matchAll(pattern)) {
    const href = match[1]!;
    const title = cleanText(match[2]!);
    if (!title.includes("会議録")) continue;
    if (title.includes("議決結果")) continue;

    const detailUrl = toAbsoluteUrl(href, pageUrl);
    if (seen.has(detailUrl)) continue;
    seen.add(detailUrl);

    meetings.push({
      title,
      detailUrl,
      year,
      meetingType: detectMeetingType(title),
    });
  }

  return meetings;
}

export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<ChikuzenMeeting[]> {
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPage(topHtml, baseUrl);
  const yearPage = yearPages.find((page) => page.year === year);
  if (!yearPage) return [];

  const yearHtml = await fetchPage(yearPage.url);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, yearPage.url, year);
}
