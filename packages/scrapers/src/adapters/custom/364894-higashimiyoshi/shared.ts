/**
 * 東みよし町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.higashimiyoshi.lg.jp/gikai/
 * 一覧記事: https://www.town.higashimiyoshi.lg.jp/docs/535.html
 * 自治体コード: 364894
 */

export const BASE_ORIGIN = "https://www.town.higashimiyoshi.lg.jp";
export const LIST_PAGE_URL = `${BASE_ORIGIN}/docs/535.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを判定する。 */
export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) {
    return "extraordinary";
  }
  return "plenary";
}

/** 相対 URL を絶対 URL に変換する。 */
export function toAbsoluteUrl(href: string): string {
  return new URL(href, BASE_ORIGIN).toString();
}

/** 全角数字を半角に揃える。 */
export function normalizeFullWidth(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/** fetch して UTF-8 テキストを返す。 */
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

/** fetch して ArrayBuffer を返す。 */
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
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}
