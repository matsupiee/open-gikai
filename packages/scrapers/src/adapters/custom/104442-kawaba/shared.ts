/**
 * 川場村議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.vill.kawaba.gunma.jp/kurashi/gikai/kaigiroku/
 * 自治体コード: 104442
 */

export const BASE_ORIGIN = "https://www.vill.kawaba.gunma.jp";
export const LIST_PAGE_URL = `${BASE_ORIGIN}/kurashi/gikai/kaigiroku/`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[104442-kawaba] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (error) {
    console.warn(
      `[104442-kawaba] fetchPage error: ${url}`,
      error instanceof Error ? error.message : error,
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
      console.warn(`[104442-kawaba] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (error) {
    console.warn(
      `[104442-kawaba] fetchBinary error: ${url}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

export function collapseWhitespace(text: string): string {
  return toHalfWidth(text)
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/　+/g, " ")
    .trim();
}

export function resolveUrl(href: string, baseUrl = LIST_PAGE_URL): string {
  return new URL(href, baseUrl).toString();
}

export function parseWarekiYear(text: string): number | null {
  const normalized = toHalfWidth(text);

  const reiwaMatch = normalized.match(/令和(元|\d+)年?/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : Number(reiwaMatch[1]);
    return 2018 + eraYear;
  }

  const heiseiMatch = normalized.match(/平成(元|\d+)年?/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : Number(heiseiMatch[1]);
    return 1988 + eraYear;
  }

  return null;
}

export function detectMeetingType(title: string): "plenary" | "committee" | "extraordinary" {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

export function extractExternalIdKey(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/?#]+)\.pdf(?:[?#]|$)/i);
  return match ? match[1] ?? null : null;
}
