/**
 * 川棚町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.kawatana.jp/cat05/c5-11/post_267/
 */

export const TOP_URL = "https://www.kawatana.jp/cat05/c5-11/post_267/";
export const BASE_ORIGIN = "https://www.kawatana.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[kawatana] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリを返す */
export async function fetchBinary(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.warn(`[kawatana] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/** 和暦の数字（全角・半角）を数値に変換 */
export function parseJapaneseNumber(s: string): number | null {
  const normalized = s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/元/g, "1");
  const n = parseInt(normalized, 10);
  return isNaN(n) ? null : n;
}

/** 和暦年号 + 数字を西暦に変換 */
export function toWesternYear(era: string, yearStr: string): number | null {
  const y = parseJapaneseNumber(yearStr);
  if (y === null) return null;
  if (era === "令和") return 2018 + y;
  if (era === "平成") return 1988 + y;
  if (era === "昭和") return 1925 + y;
  return null;
}

/** YYYY-MM-DD を生成 */
export function buildDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
