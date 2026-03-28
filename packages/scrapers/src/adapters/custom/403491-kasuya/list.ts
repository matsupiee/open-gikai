import {
  detectMeetingType,
  fetchPage,
  parseWarekiYear,
  resolveUrl,
} from "./shared";

export interface KasuyaMeeting {
  pdfUrl: string;
  title: string;
  meetingType: "plenary" | "extraordinary" | "committee";
}

export function extractWesternYear(title: string): number | null {
  return parseWarekiYear(title);
}

export function parseIndexPage(
  html: string,
): { year: number; yearPageUrl: string }[] {
  const results: { year: number; yearPageUrl: string }[] = [];
  const pattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const href = match[1]!;
    const text = match[2]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    const year = extractWesternYear(text);
    if (!year) continue;

    results.push({
      year,
      yearPageUrl: resolveUrl(href, "https://www.town.kasuya.fukuoka.jp/li/080/030/index.html"),
    });
  }

  return results;
}

function cleanLinkText(text: string): string {
  return text.replace(/\s+/g, " ").replace(/\s*（PDF[^）]*）\s*$/i, "").trim();
}

export function parseYearPage(html: string, pageUrl: string): KasuyaMeeting[] {
  const results: KasuyaMeeting[] = [];
  const pattern =
    /<li[^>]*class="pdf"[^>]*>\s*<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi;

  for (const match of html.matchAll(pattern)) {
    const href = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "");
    const title = cleanLinkText(rawText);
    if (!title) continue;

    results.push({
      pdfUrl: resolveUrl(href, pageUrl),
      title,
      meetingType: detectMeetingType(title),
    });
  }

  return results;
}

export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<KasuyaMeeting[]> {
  const indexHtml = await fetchPage(baseUrl);
  if (!indexHtml) return [];

  const yearPages = parseIndexPage(indexHtml);
  const target = yearPages.find((page) => page.year === year);
  if (!target) return [];

  const yearHtml = await fetchPage(target.yearPageUrl);
  if (!yearHtml) return [];

  return parseYearPage(yearHtml, target.yearPageUrl);
}
