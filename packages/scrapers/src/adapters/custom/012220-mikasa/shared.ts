/**
 * 三笠市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.mikasa.hokkaido.jp/hotnews/category/307.html
 * 自治体コード: 012220
 */

export const BASE_ORIGIN = "https://www.city.mikasa.hokkaido.jp";

export const CATEGORY_URL = `${BASE_ORIGIN}/hotnews/category/307.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
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
      console.warn(`[012220-mikasa] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[012220-mikasa] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[012220-mikasa] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[012220-mikasa] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 全角数字を半角に変換する。
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
}

/**
 * 和暦の年（例: "令和7"、"令和元"、"平成17"）を西暦に変換する。
 */
export function convertWarekiYear(era: string, yearStr: string): number | null {
  const eraYear = yearStr === "元" ? 1 : parseInt(yearStr, 10);
  if (isNaN(eraYear)) return null;

  if (era === "令和") return 2018 + eraYear;
  if (era === "平成") return 1988 + eraYear;
  return null;
}
