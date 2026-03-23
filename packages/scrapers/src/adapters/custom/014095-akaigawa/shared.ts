/**
 * 赤井川村議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.akaigawa.com/kurashi/gikai_jimukyoku/post_95.html
 * 自治体コード: 014095
 */

export const BASE_ORIGIN = "https://www.akaigawa.com";

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
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
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
 * 和暦の日付テキストを YYYY-MM-DD に変換する。
 * 全角数字にも対応する。
 * パターン: 「令和X年X月X日」
 */
export function convertWarekiDateToISO(text: string): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/令和(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const eraYear = match[1] === "元" ? 1 : parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const day = parseInt(match[3]!, 10);
  const westernYear = 2018 + eraYear;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 和暦の年を西暦に変換する。
 * 令和元年 → 2019, 令和2年 → 2020 等。
 * 全角数字にも対応する。
 */
export function convertWarekiToWesternYear(text: string): number | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/令和(元|\d+)年/);
  if (!match) return null;
  const eraYear = match[1] === "元" ? 1 : parseInt(match[1]!, 10);
  return 2018 + eraYear;
}
