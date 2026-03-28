/**
 * Fukushima Town council minutes scraper shared utilities.
 *
 * Site: https://www.town.fukushima.hokkaido.jp/gikai/
 * Municipality code: 013323
 *
 * The site exposes fiscal-year filtered pages under the conference materials
 * landing page. Each fiscal year page contains both plenary sessions and
 * committee pages depending on the kind selector.
 */

export const BASE_ORIGIN = "https://www.town.fukushima.hokkaido.jp";
export const CONFERENCE_MATERIALS_URL =
  `${BASE_ORIGIN}/gikai/%E4%BC%9A%E8%AD%B0%E8%B3%87%E6%96%99%E3%83%BB%E6%98%A0%E5%83%8F/`;

export const TARGET_KIND_IDS = [17, 16, 14, 13, 12, 11, 10, 9] as const;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function buildListUrl(fiscalYear: number, kindId: number): string {
  const url = new URL(CONFERENCE_MATERIALS_URL);
  url.searchParams.set("year_of_conferenceMaterial", String(fiscalYear));
  url.searchParams.set("kind_of_conferenceMaterial", String(kindId));
  return url.toString();
}

export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (/(委員会|協議会|諮問会議)/.test(title)) return "committee";
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
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export function toHalfWidth(text: string): string {
  return text.replace(/[０-９（）．]/g, (char) => {
    if (char === "（") return "(";
    if (char === "）") return ")";
    if (char === "．") return ".";
    return String.fromCharCode(char.charCodeAt(0) - 0xfee0);
  });
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

/**
 * Normalize PDF text where Japanese characters are split by spaces.
 * Example: "議 長 （ 山 田 太 郎 君 ）" -> "議長（山田太郎君）"
 */
export function normalizeSpaces(text: string): string {
  return text
    .replace(/\f/g, "\n")
    .replace(/([^\x00-\x7F])[^\S\n]+(?=[^\x00-\x7F])/g, "$1");
}
