/**
 * むかわ町議会 — 共通ユーティリティ
 *
 * サイト: http://www.town.mukawa.lg.jp/2872.htm
 * 自治体コード: 015865
 */

export const BASE_ORIGIN = "http://www.town.mukawa.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("協議会")) return "committee";
  if (title.includes("審議会")) return "committee";
  if (title.includes("審査会")) return "committee";
  if (title.includes("会議") && !title.includes("議会")) return "committee";
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
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** fetch してバイナリを返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 和暦年号文字列 (例: "令和7", "平成30", "令和元") を西暦に変換する。
 */
export function eraYearToSeireki(era: string, yearStr: string): number | null {
  const y = yearStr === "元" ? 1 : parseInt(yearStr, 10);
  if (isNaN(y)) return null;
  if (era === "R" || era === "令和") return 2018 + y;
  if (era === "H" || era === "平成") return 1988 + y;
  return null;
}
