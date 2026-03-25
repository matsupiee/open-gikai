/**
 * 余市町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.yoichi.hokkaido.jp/gikai/kaigiroku/
 * 自治体コード: 014087
 */

export const BASE_ORIGIN = "https://www.town.yoichi.hokkaido.jp";
export const LIST_PATH = "/gikai/kaigiroku/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
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

const PDF_FETCH_TIMEOUT_MS = 60_000;

/** fetch してバイナリ（ArrayBuffer）を返す */
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
 * 全角数字を半角に変換する。
 * 例: "１２３" → "123"
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
}

/**
 * 令和の和暦年（数字）を西暦に変換する。
 * 「元」年に対応（令和元年 = 2019年）
 */
export function reiwaToWestern(eraYearStr: string): number {
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  return 2018 + eraYear;
}
