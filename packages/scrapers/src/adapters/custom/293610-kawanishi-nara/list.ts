import {
  delay,
  detectMeetingType,
  fetchPage,
  matchesYearLink,
  normalizeHtmlText,
  parseDateText,
  parseWarekiYears,
  resolveUrl,
  type KawanishiMeetingType,
} from "./shared";

export interface KawanishiYearPageLink {
  title: string;
  url: string;
}

export interface KawanishiSessionInfo {
  title: string;
  heldOn: string | null;
  pdfUrl: string;
  meetingType: KawanishiMeetingType;
  pageUrl: string;
  linkLabel: string;
  year: number | null;
}

const INTER_PAGE_DELAY_MS = 1_000;

export async function fetchSessionList(
  baseUrl: string,
  year: number,
): Promise<KawanishiSessionInfo[]> {
  const topHtml = await fetchPage(baseUrl);
  if (!topHtml) return [];

  const yearPages = parseTopPageLinks(topHtml).filter((page) =>
    matchesYearLink(page.title, year),
  );
  if (yearPages.length === 0) return [];

  const sessions: KawanishiSessionInfo[] = [];

  for (const [index, page] of yearPages.entries()) {
    if (index > 0) {
      await delay(INTER_PAGE_DELAY_MS);
    }

    const yearHtml = await fetchPage(page.url);
    if (!yearHtml) continue;

    for (const session of parseYearPage(yearHtml, page.url)) {
      if (session.year === year) {
        sessions.push(session);
      }
    }
  }

  return sessions;
}

export function parseTopPageLinks(html: string): KawanishiYearPageLink[] {
  const sectionMatch = html.match(
    /<div[^>]*class="kakuka_box"[^>]*>[\s\S]*?<h2>\s*会議録\s*<\/h2>\s*<ul>([\s\S]*?)<\/ul>/i,
  );
  if (!sectionMatch?.[1]) return [];

  const links: KawanishiYearPageLink[] = [];
  const seen = new Set<string>();
  const pattern = /<li[^>]*>\s*<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;

  for (const match of sectionMatch[1].matchAll(pattern)) {
    const href = match[1];
    const title = normalizeHtmlText(match[2] ?? "");
    if (!href || !title) continue;

    const url = resolveUrl(href);
    if (seen.has(url)) continue;
    seen.add(url);

    links.push({ title, url });
  }

  return links;
}

function isSpecificMeetingTitle(title: string): boolean {
  return (
    /第\s*[0-9０-９]+\s*回.*(定例会|臨時会|委員会)/.test(title) &&
    parseDateText(title) !== null
  );
}

function extractFileLabel(linkText: string): string | null {
  const normalized = normalizeHtmlText(linkText);
  const fileNameMatch = normalized.match(/ファイル名[:：]\s*(.+?\.pdf)/);
  if (fileNameMatch?.[1]) {
    return fileNameMatch[1].replace(/\.pdf$/i, "").trim();
  }

  const basicLabel = normalized
    .replace(/^\(+/, "")
    .replace(/\)+$/, "")
    .replace(/PDF形式[^,、)]*/g, "")
    .replace(/ファイル:\s*[\d.]+\s*(?:KB|MB)/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return basicLabel || null;
}

function extractSessionYear(text: string): number | null {
  const westernYears = Array.from(
    normalizeHtmlText(text).matchAll(/\b(20\d{2}|19\d{2})\s*年\b/g),
    (match) => Number(match[1]),
  );
  if (westernYears.length > 0) {
    return westernYears[0] ?? null;
  }

  return parseWarekiYears(text)[0] ?? null;
}

function buildSessionTitle(blockTitle: string, linkText: string): string {
  if (isSpecificMeetingTitle(blockTitle)) {
    return normalizeHtmlText(blockTitle);
  }

  const fileLabel = extractFileLabel(linkText);
  if (fileLabel) return fileLabel;

  return normalizeHtmlText(blockTitle);
}

export function parseYearPage(
  html: string,
  pageUrl: string,
): KawanishiSessionInfo[] {
  const sessions: KawanishiSessionInfo[] = [];
  const seen = new Set<string>();
  const blockPattern =
    /<div[^>]*class="mol_attachfileblock[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;

  for (const blockMatch of html.matchAll(blockPattern)) {
    const blockHtml = blockMatch[1] ?? "";
    const titleMatch = blockHtml.match(
      /<p[^>]*class="mol_attachfileblock_title"[^>]*>([\s\S]*?)<\/p>/i,
    );
    if (!titleMatch?.[1]) continue;

    const blockTitle = normalizeHtmlText(
      titleMatch[1].replace(/<[^>]+>/g, ""),
    );
    if (!blockTitle) continue;

    const linkPattern = /<a[^>]+href="([^"]+\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

    for (const linkMatch of blockHtml.matchAll(linkPattern)) {
      const href = linkMatch[1];
      const rawLinkText = linkMatch[2]?.replace(/<[^>]+>/g, "") ?? "";
      if (!href) continue;

      const pdfUrl = resolveUrl(href, pageUrl);
      if (seen.has(pdfUrl)) continue;
      seen.add(pdfUrl);

      const combinedText = `${blockTitle} ${normalizeHtmlText(rawLinkText)}`;
      const title = buildSessionTitle(blockTitle, rawLinkText);
      const heldOn = parseDateText(combinedText);
      const meetingType = detectMeetingType(title);
      const year = extractSessionYear(combinedText);

      sessions.push({
        title,
        heldOn,
        pdfUrl,
        meetingType,
        pageUrl,
        linkLabel: normalizeHtmlText(rawLinkText),
        year,
      });
    }
  }

  return sessions;
}
