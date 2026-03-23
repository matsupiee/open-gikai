/**
 * 一宮町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.ichinomiya.chiba.jp/info/gikai/2/
 * 自治体コード: 124214
 */

export const BASE_ORIGIN = "https://www.town.ichinomiya.chiba.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 年度（西暦）から年度別ページ URL を返す。
 * ページ ID は連番ではなく不規則なため、全てハードコードする。
 */
export const YEAR_PAGE_MAP: Record<number, string> = {
  2025: `${BASE_ORIGIN}/info/gikai/2/16.html`,
  2024: `${BASE_ORIGIN}/info/gikai/2/15.html`,
  2023: `${BASE_ORIGIN}/info/gikai/2/14.html`,
  2022: `${BASE_ORIGIN}/info/gikai/2/13.html`,
  2021: `${BASE_ORIGIN}/info/gikai/2/12.html`,
  2020: `${BASE_ORIGIN}/info/gikai/2/11.html`,
  2019: `${BASE_ORIGIN}/info/gikai/2/10.html`,
  2018: `${BASE_ORIGIN}/info/gikai/2/9/`,
  2017: `${BASE_ORIGIN}/info/gikai/2/8.html`,
  2016: `${BASE_ORIGIN}/info/gikai/2/2.html`,
  2015: `${BASE_ORIGIN}/info/gikai/2/3.html`,
  2014: `${BASE_ORIGIN}/info/gikai/2/4.html`,
  2013: `${BASE_ORIGIN}/info/gikai/2/5.html`,
};

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
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

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
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
