/**
 * 中央区議会 会議録検索システム — 共通ユーティリティ
 *
 * サイト: https://www.kugikai.city.chuo.lg.jp/kaigiroku/index.cgi
 */

export const BASE_ORIGIN = "https://www.kugikai.city.chuo.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("全員協議会")) return "committee";
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
 * 一覧ページを POST で取得する。
 *
 * sel_year は平成年号ベースの連番 (western_year - 1988)。
 * sort_day=asc で古い順に返す。
 */
export async function fetchListPage(
  baseUrl: string,
  year: number,
): Promise<string | null> {
  try {
    const url = new URL(baseUrl);
    const selYear = year - 1988;

    const res = await fetch(url.href, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        term: "date",
        sel_year: String(selYear),
        sort_day: "asc",
        searchlist: "検索",
      }).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * 会議録詳細ページの URL を組み立てる。
 * 相対パス（../kaigiroku.cgi/...）を絶対 URL に変換する。
 */
export function buildDetailUrl(href: string, origin: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${origin}${href}`;
  return `${origin}/${href.replace(/^\.\.\//, "")}`;
}
