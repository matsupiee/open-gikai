/**
 * 東通村議会 — 共通ユーティリティ
 *
 * サイト: http://www.vill.higashidoori.lg.jp/
 *
 * 東通村は会議録検索システム未導入で、
 * 「議会開催状況」HTML と「議会だより」PDF を組み合わせて取得する。
 */

export const BASE_ORIGIN = "http://www.vill.higashidoori.lg.jp";
export const MEETING_LIST_URL = `${BASE_ORIGIN}/gikai/page520011.html`;
export const NEWSLETTER_LIST_URL = `${BASE_ORIGIN}/gikai/page520012.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

export function normalizeText(text: string): string {
  return normalizeDigits(text).replace(/[\u00a0\s　]+/g, " ").trim();
}

export function toFullWidthDigits(text: string): string {
  return text.replace(/\d/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 0xfee0),
  );
}

export function convertJapaneseEra(
  era: string,
  eraYearText: string,
): number | null {
  const eraYear = eraYearText === "元" ? 1 : Number(normalizeDigits(eraYearText));
  if (!Number.isInteger(eraYear)) return null;

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  if (era === "昭和") return eraYear + 1925;
  return null;
}

export function parseJapaneseDate(text: string): string | null {
  const normalized = normalizeDigits(text);
  const match = normalized.match(/(令和|平成|昭和)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const year = convertJapaneseEra(match[1]!, match[2]!);
  if (!year) return null;

  const month = Number(match[3]!);
  const day = Number(match[4]!);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`fetchPage failed: ${url} status=${response.status}`);
      return null;
    }

    return await response.text();
  } catch (error) {
    console.warn(
      `fetchPage error: ${url}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`fetchBinary failed: ${url} status=${response.status}`);
      return null;
    }

    return await response.arrayBuffer();
  } catch (error) {
    console.warn(
      `fetchBinary error: ${url}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export function buildExternalId(heldOn: string, title: string): string {
  const slug = normalizeDigits(title)
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `higashidoori_${heldOn}_${slug}`;
}

