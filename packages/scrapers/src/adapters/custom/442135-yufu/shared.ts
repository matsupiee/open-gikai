/**
 * 由布市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.yufu.oita.jp/
 * 自治体コード: 442135
 */

export const BASE_ORIGIN = "https://www.city.yufu.oita.jp";

/** 会議録一覧ページ URL */
export const LIST_URL = `${BASE_ORIGIN}/city_council/shigikai/shigikai_cate5/gijirokukensaku`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** fetch して UTF-8 テキストを返す。失敗時は null を返す。 */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[442135-yufu] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す。失敗時は null を返す。 */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[442135-yufu] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/**
 * 会議タイプを検出する。
 */
export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会") || title.includes("協議会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦年表記から西暦を返す。
 * 例: "令和6" → 2024, "平成31" → 2019, "令和元" → 2019
 * 変換できない場合は null を返す。
 */
export function parseWarekiYear(era: string, yearStr: string): number | null {
  const n = yearStr === "元" ? 1 : parseInt(yearStr, 10);
  if (isNaN(n)) return null;
  if (era === "令和") return 2018 + n;
  if (era === "平成") return 1988 + n;
  if (era === "昭和") return 1925 + n;
  return null;
}

/**
 * 全角数字を半角数字に変換する。
 * 例: "７" → "7"
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
