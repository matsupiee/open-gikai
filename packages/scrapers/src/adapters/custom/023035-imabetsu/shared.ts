/**
 * 今別町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.imabetsu.lg.jp/gyousei/gikai/
 */

export const BASE_URL = "https://www.town.imabetsu.lg.jp/gyousei/gikai";
export const LIST_URL = `${BASE_URL}/dayori.html`;

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
    console.warn(`[imabetsu] fetchPage failed: ${url}`, e);
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
    console.warn(`[imabetsu] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/**
 * 会議タイプを分類する。
 * 議会だよりは「広報誌」扱いとする。
 */
export function detectMeetingType(_title: string): string {
  return "plenary";
}

/**
 * 発行日テキストから YYYY-MM-DD 形式に変換する。
 * 入力例: "（２月３日発行）", "（11月22日発行）"
 * year: 発行年（h2 テキストから取得）
 *
 * 解析できない場合は null を返す。
 */
export function parseDateText(
  dateText: string,
  year: string,
): string | null {
  // 年を取得: "2025年" → 2025
  const yearMatch = year.match(/(\d{4})/);
  if (!yearMatch?.[1]) return null;
  const yearNum = parseInt(yearMatch[1], 10);

  // 月日を取得: "（２月３日発行）" or "（11月22日発行）"
  // 全角数字を半角に変換してからパース
  const normalized = dateText
    .replace(/[０-９]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
    )
    .replace(/[（(）)]/g, "");

  const dateMatch = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (!dateMatch?.[1] || !dateMatch?.[2]) return null;

  const month = parseInt(dateMatch[1], 10);
  const day = parseInt(dateMatch[2], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${yearNum}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
