/**
 * 剣淵町議会 会議録（議決結果）-- 共通ユーティリティ
 *
 * サイト: https://www.town.kembuchi.hokkaido.jp/gikai/会議記録/
 *
 * 剣淵町は全文会議録ではなく、議決結果 PDF のみを公開している。
 */

export const BASE_ORIGIN = "https://www.town.kembuchi.hokkaido.jp";
export const LIST_PATH = "/gikai/%E4%BC%9A%E8%AD%B0%E8%A8%98%E9%8C%B2/";
export const LIST_URL = `${BASE_ORIGIN}${LIST_PATH}`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function toHalfWidth(value: string): string {
  return value.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30),
  );
}

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function compactJapaneseText(value: string): string {
  return normalizeWhitespace(toHalfWidth(value)).replace(/\s+/g, "");
}

export function detectMeetingType(title: string): string {
  if (/臨時/.test(title)) return "extraordinary";
  if (/委員会/.test(title)) return "committee";
  return "plenary";
}

export function eraToWesternYear(era: string, eraYearText: string): number | null {
  const eraYear = eraYearText === "元" ? 1 : Number(toHalfWidth(eraYearText));
  if (!Number.isFinite(eraYear)) return null;
  if (era === "令和") return 2018 + eraYear;
  if (era === "平成") return 1988 + eraYear;
  return null;
}

export function parseEraDate(dateText: string): string | null {
  const normalized = normalizeWhitespace(toHalfWidth(dateText));
  const match = normalized.match(/(令和|平成)\s*(元|\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/);
  if (!match) return null;

  const westernYear = eraToWesternYear(match[1]!, match[2]!);
  if (!westernYear) return null;

  const month = Number(match[3]!);
  const day = Number(match[4]!);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
  } catch (error) {
    console.warn(`fetchPage error: ${url}`, error instanceof Error ? error.message : error);
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
  } catch (error) {
    console.warn(`fetchBinary error: ${url}`, error instanceof Error ? error.message : error);
    return null;
  }
}
