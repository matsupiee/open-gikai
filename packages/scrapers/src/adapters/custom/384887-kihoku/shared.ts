/**
 * 鬼北町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.kihoku.ehime.jp/site/gikai/list17-364.html
 */

export const BASE_ORIGIN = "https://www.town.kihoku.ehime.jp";

/** 年度一覧ページ URL */
export const INDEX_URL = `${BASE_ORIGIN}/site/gikai/list17-364.html`;

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
    console.warn(`[kihoku] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリを返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[kihoku] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/**
 * 和暦テキストを YYYY-MM-DD に変換する。
 * 例: "令和6年3月7日" → "2024-03-07"
 * パースできない場合は null を返す。
 */
export function parseJapaneseDate(text: string): string | null {
  const match = text.match(/(令和|平成)(\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1];
  const eraYear = parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  let year: number;
  if (era === "令和") {
    year = 2018 + eraYear;
  } else if (era === "平成") {
    year = 1988 + eraYear;
  } else {
    return null;
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
