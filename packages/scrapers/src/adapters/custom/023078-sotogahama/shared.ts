/**
 * 外ヶ浜町議会 — 共通ユーティリティ
 *
 * サイト: http://www.town.sotogahama.lg.jp/gyosei/gikai/
 */

export const BASE_URL = "http://www.town.sotogahama.lg.jp/gyosei/gikai";
export const DAYORI_LIST_URL = `${BASE_URL}/gikai_dayori.html`;
export const IPPAN_LIST_URL = `${BASE_URL}/ippan_situmon.html`;

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
    console.warn(`[sotogahama] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリ (ArrayBuffer) を返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[sotogahama] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/**
 * PDF ファイル名から発行年月を抽出し YYYY-MM-DD 形式に変換する。
 *
 * ファイル名パターン:
 *   - 議会だより: YYYYMM_soto_gikaidayori_XX.pdf
 *   - 一般質問通告表: YYYYMM_ippan_situmon.pdf
 *
 * 日付は YYYYMM の月の1日とする。
 */
export function parseDateFromFilename(filename: string): string | null {
  const match = filename.match(/^(\d{4})(\d{2})_/);
  if (!match?.[1] || !match?.[2]) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);

  if (month < 1 || month > 12) return null;

  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * PDF の href を絶対 URL に変換する。
 */
export function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http")) return href;
  return `${BASE_URL}/${href.replace(/^\//, "")}`;
}
