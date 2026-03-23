/**
 * 八丈町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.hachijo.tokyo.jp/kakuka/gikai/kaigiroku.html
 * PDF ベースの議事録公開。単一ページに全年度分を掲載。
 */

export const BASE_URL =
  "https://www.town.hachijo.tokyo.jp/kakuka/gikai/kaigiroku.html";

export const BASE_ORIGIN = "https://www.town.hachijo.tokyo.jp/kakuka/gikai/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(session: string): string {
  if (session.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** fetch して UTF-8 テキストを返す */
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

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
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

/**
 * 和暦の短縮日付テキストから YYYY-MM-DD を返す。
 * e.g., "R7.3.3" → "2025-03-03", "H30.9.4" → "2018-09-04"
 *       "R1.6.11" → "2019-06-11", "H31.3.1" → "2019-03-01"
 */
export function parseDateText(text: string): string | null {
  const match = text.match(/([RH])(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = Number(eraYearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  let westernYear: number;
  if (era === "R") westernYear = eraYear + 2018;
  else if (era === "H") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
