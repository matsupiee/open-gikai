/**
 * 五木村議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.vill.itsuki.lg.jp/list00107.html
 */

export const BASE_ORIGIN = "https://www.vill.itsuki.lg.jp";

/** 会議録一覧ページの URL */
export const LIST_URL = `${BASE_ORIGIN}/list00107.html`;

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
    console.warn(`[435112-itsuki] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリを返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[435112-itsuki] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/**
 * 和暦年文字列を西暦に変換する。
 * 例: era="令和", year=6 → 2024
 */
export function convertJapaneseYear(era: string, year: number): number {
  if (era === "令和") return 2018 + year;
  if (era === "平成") return 1988 + year;
  if (era === "昭和") return 1925 + year;
  return year;
}
