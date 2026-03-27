import { BASE_ORIGIN, fetchPage } from "./shared";

export interface AsakawaMeeting {
  pdfUrl: string;
  title: string;
  heldOn: string;
  sessionName: string;
}

function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

export function parseDateText(
  sessionName: string,
  linkText: string,
): string | null {
  const normalizedSession = normalizeDigits(sessionName).replace(/\s+/g, "");
  const normalizedLink = normalizeDigits(linkText).replace(/\s+/g, "");

  const sessionMatch = normalizedSession.match(/(令和|平成)(元|\d+)年(?:度)?第/);
  const dateMatch = normalizedLink.match(/\((\d+)月(\d+)日\)/);
  if (!sessionMatch || !dateMatch) return null;

  const [, era, eraYearText] = sessionMatch;
  const [, monthText, dayText] = dateMatch;
  const eraYear = eraYearText === "元" ? 1 : Number(eraYearText);
  const month = Number(monthText);
  const day = Number(dayText);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseListPage(
  html: string,
  baseUrl: string,
  year?: number,
): AsakawaMeeting[] {
  const results: AsakawaMeeting[] = [];
  const sessionHeaders: { index: number; name: string }[] = [];

  const headingPattern =
    /<h3[^>]*class="[^"]*(?:gikai-kiroku__ttl|pulldown-btn)[^"]*"[^>]*>([^<]+)<\/h3>/g;
  for (const match of html.matchAll(headingPattern)) {
    sessionHeaders.push({
      index: match.index ?? 0,
      name: match[1]!.trim(),
    });
  }

  const linkPattern =
    /<a[^>]+href="([^"]+\.pdf)"[^>]*class="[^"]*gikai-kiroku__link[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;

  const baseDir = baseUrl.replace(/\/[^/]*$/, "/");

  for (const match of html.matchAll(linkPattern)) {
    const linkIndex = match.index ?? 0;
    const href = match[1]!;
    const linkText = match[2]!.replace(/<[^>]+>/g, "").trim();

    if (linkText === "目次") continue;

    let sessionName = "";
    for (const header of sessionHeaders) {
      if (header.index < linkIndex) {
        sessionName = header.name;
      }
    }

    const heldOn = parseDateText(sessionName, linkText);
    if (!heldOn) continue;

    if (year !== undefined) {
      const heldYear = Number(heldOn.slice(0, 4));
      if (heldYear !== year) continue;
    }

    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${baseDir}${href}`;
    }

    const title = sessionName ? `${sessionName} ${linkText}` : linkText;
    results.push({
      pdfUrl,
      title,
      heldOn,
      sessionName,
    });
  }

  return results;
}

export async function fetchMeetingList(
  baseUrl: string,
  year: number,
): Promise<AsakawaMeeting[]> {
  const html = await fetchPage(baseUrl);
  if (!html) return [];

  return parseListPage(html, baseUrl, year);
}
