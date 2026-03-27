export const BASE_ORIGIN = "https://www.town.haebaru.lg.jp";

const DEFAULT_LIST_URL = `${BASE_ORIGIN}/site/gikai/list64-90.html`;
const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai)";
const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function buildListUrl(baseUrl?: string): string {
  if (!baseUrl) return DEFAULT_LIST_URL;

  try {
    const url = new URL(baseUrl);
    if (
      url.hostname === "www.town.haebaru.lg.jp" &&
      url.pathname === "/site/gikai/list64-90.html"
    ) {
      return url.toString();
    }
  } catch {}

  return DEFAULT_LIST_URL;
}

export function buildAbsoluteUrl(href: string, baseUrl = BASE_ORIGIN): string {
  return new URL(href, baseUrl).toString();
}

export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

export function toJapaneseEra(year: number): string[] {
  const results: string[] = [];

  if (year >= 2020) {
    results.push(`令和${year - 2018}年`);
  } else if (year === 2019) {
    results.push("令和元年");
    results.push("平成31年");
  } else if (year >= 1989) {
    const eraYear = year - 1988;
    results.push(eraYear === 1 ? "平成元年" : `平成${eraYear}年`);
  }

  return results;
}

export function extractExternalIdKey(pdfUrl: string): string | null {
  const path = new URL(pdfUrl).pathname;
  const match = path.match(/\/uploaded\/attachment\/(\d+)\.pdf$/i);
  if (!match) return null;
  return match[1] ?? null;
}
