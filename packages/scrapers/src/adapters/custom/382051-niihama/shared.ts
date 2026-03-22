/**
 * 新居浜市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.niihama.lg.jp/site/gikai/
 * 自治体コード: 382051
 *
 * 本会議会議録は HTML で公開されている。
 * 一覧ページの URL は年度によって異なる:
 *   - 2024以降: /site/gikai/kaigiroku{year}.html
 *   - 2023以前: /soshiki/gikai/kaigiroku{year}.html
 * 詳細ページの URL は全年度共通:
 *   - /site/gikai/kaigiroku{year}-{session}-{number}.html
 */

export const BASE_ORIGIN = "https://www.city.niihama.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
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
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * 年度別一覧ページの URL を組み立てる。
 * 2024以降: /site/gikai/kaigiroku{year}.html
 * 2023以前: /soshiki/gikai/kaigiroku{year}.html
 */
export function buildListUrl(year: number): string {
  const prefix = year >= 2024 ? "/site/gikai" : "/soshiki/gikai";
  return `${BASE_ORIGIN}${prefix}/kaigiroku${year}.html`;
}

/**
 * 個別会議録ページの URL を組み立てる。
 */
export function buildDetailUrl(year: number, session: number, number: number): string {
  return `${BASE_ORIGIN}/site/gikai/kaigiroku${year}-${session}-${number}.html`;
}
