/**
 * 日高村議会 議会だより — 共通ユーティリティ
 *
 * サイト: https://www.vill.hidaka.kochi.jp/
 * 議会だよりページ:
 * - 現行: https://www.vill.hidaka.kochi.jp/kurashi/child_category_free_page.cgi?SITE_ID=1&CATEGORY_ID=1&CATEGORY_ID2=1&CATEGORY_ID3=1&CATEGORY_ID4=2&FREE_PAGE_ID=787
 * - 過去: https://www.vill.hidaka.kochi.jp/kurashi/child_category_free_page.cgi?SITE_ID=1&CATEGORY_ID=1&CATEGORY_ID2=1&CATEGORY_ID3=1&CATEGORY_ID4=1&FREE_PAGE_ID=199
 */

export const BASE_ORIGIN = "https://www.vill.hidaka.kochi.jp";

export const CURRENT_PAGE_URL =
  "https://www.vill.hidaka.kochi.jp/kurashi/child_category_free_page.cgi?SITE_ID=1&CATEGORY_ID=1&CATEGORY_ID2=1&CATEGORY_ID3=1&CATEGORY_ID4=2&FREE_PAGE_ID=787";

export const ARCHIVE_PAGE_URL =
  "https://www.vill.hidaka.kochi.jp/kurashi/child_category_free_page.cgi?SITE_ID=1&CATEGORY_ID=1&CATEGORY_ID2=1&CATEGORY_ID3=1&CATEGORY_ID4=1&FREE_PAGE_ID=199";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30)
  );
}

export function cleanText(text: string): string {
  return normalizeDigits(text)
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
}

export function resolveUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${BASE_ORIGIN}${url}`;
  return `${BASE_ORIGIN}/kurashi/${url.replace(/^\.\//, "")}`;
}

export function eraToWesternYear(
  era: string,
  eraYearText: string
): number | null {
  const eraYear = eraYearText === "元" ? 1 : Number(normalizeDigits(eraYearText));
  if (Number.isNaN(eraYear)) return null;

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  if (era === "昭和") return eraYear + 1925;
  return null;
}

export function parseEraDate(text: string): string | null {
  const normalized = cleanText(text);
  const match = normalized.match(/(令和|平成|昭和)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const year = eraToWesternYear(match[1]!, match[2]!);
  if (!year) return null;

  return `${year}-${String(Number(match[3])).padStart(2, "0")}-${String(
    Number(match[4])
  ).padStart(2, "0")}`;
}

export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
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
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e
    );
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
