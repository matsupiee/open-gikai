/**
 * 本山町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.motoyama.kochi.jp/soshikikarasagasu/gikaijimukyoku/teireirinnji/teireikairinzikaikaigiroku/index.html
 * SMART CMS を使用。PDF 形式で年度別ページに会議録を掲載。
 */

export const BASE_ORIGIN = "https://www.town.motoyama.kochi.jp";

/** 会議録トップページ URL */
export const TOP_URL = `${BASE_ORIGIN}/soshikikarasagasu/gikaijimukyoku/teireirinnji/teireikairinzikaikaigiroku/index.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
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
 * 和暦の日付テキストから YYYY-MM-DD を返す。
 * 「元年」にも対応。
 *
 * e.g., "令和6年12月3日" → "2024-12-03"
 * e.g., "令和元年3月5日" → "2019-03-05"
 */
export function parseWarekiDate(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 和暦テキストから西暦年を返す。
 * 「元年」にも対応。
 *
 * e.g., "令和6年" → 2024
 * e.g., "令和元年" → 2019
 */
export function parseWarekiYear(text: string): number | null {
  const match = text.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, eraYearStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}
