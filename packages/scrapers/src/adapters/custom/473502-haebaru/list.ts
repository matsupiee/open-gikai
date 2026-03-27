import {
  buildAbsoluteUrl,
  buildListUrl,
  fetchPage,
  toJapaneseEra,
} from "./shared";

export interface YearPage {
  label: string;
  url: string;
}

export interface SessionPage {
  title: string;
  url: string;
}

export interface HaebaruMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionTitle: string;
}

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function toAsciiDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  );
}

function normalizeLabel(text: string): string {
  return stripTags(text)
    .replace(/\[(?:PDF|Word)ファイル[^[]*]/g, "")
    .replace(/（(?:PDF|Word)形式[^）]*）/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseTopPage(html: string): YearPage[] {
  const pages: YearPage[] = [];
  const seen = new Set<string>();
  const pattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    const label = stripTags(match[2] ?? "");
    if (!href || !label.includes("会議録一覧")) continue;
    if (!/(令和|平成)/.test(label)) continue;

    const url = buildAbsoluteUrl(href);
    if (seen.has(url)) continue;
    seen.add(url);
    pages.push({ label, url });
  }

  return pages;
}

export function parseYearPage(html: string): SessionPage[] {
  const pages: SessionPage[] = [];
  const seen = new Set<string>();
  const pattern = /<a[^>]+href="(\/soshiki\/2\/\d+\.html)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    const title = stripTags(match[2] ?? "");
    if (!href || !/(定例会|臨時会)/.test(title)) continue;

    const url = buildAbsoluteUrl(href);
    if (seen.has(url)) continue;
    seen.add(url);
    pages.push({ title, url });
  }

  return pages;
}

export function parseHeldOnFromLabel(
  label: string,
  year: number
): string | null {
  const normalized = toAsciiDigits(label);
  const match = normalized.match(/^(\d{2})(\d{2})/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseMeetingPage(
  html: string,
  pageUrl: string,
  year: number
): HaebaruMeeting[] {
  const sessionTitle =
    stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "").replace(
      /\s*会議録$/,
      ""
    ) || "会議録";
  const meetings: HaebaruMeeting[] = [];
  const pattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const href = match[1];
    const label = normalizeLabel(match[2] ?? "");
    const heldOn = parseHeldOnFromLabel(label, year);
    if (!href || !label || !heldOn) continue;

    meetings.push({
      pdfUrl: buildAbsoluteUrl(href, pageUrl),
      title: `${sessionTitle} ${label}`,
      heldOn,
      sessionTitle,
    });
  }

  return meetings;
}

export async function fetchMeetingList(
  baseUrl: string,
  year: number
): Promise<HaebaruMeeting[]> {
  const listHtml = await fetchPage(buildListUrl(baseUrl));
  if (!listHtml) return [];

  const yearPages = parseTopPage(listHtml);
  const eraLabels = toJapaneseEra(year);
  const yearPage = yearPages.find((page) =>
    eraLabels.some((label) => page.label.includes(label))
  );
  if (!yearPage) return [];

  const yearHtml = await fetchPage(yearPage.url);
  if (!yearHtml) return [];

  const sessionPages = parseYearPage(yearHtml);
  const meetings: HaebaruMeeting[] = [];
  const seen = new Set<string>();

  for (const sessionPage of sessionPages) {
    const sessionHtml = await fetchPage(sessionPage.url);
    if (!sessionHtml) continue;

    for (const meeting of parseMeetingPage(sessionHtml, sessionPage.url, year)) {
      if (seen.has(meeting.pdfUrl)) continue;
      seen.add(meeting.pdfUrl);
      meetings.push(meeting);
    }
  }

  return meetings;
}
