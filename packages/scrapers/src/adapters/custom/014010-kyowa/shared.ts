/**
 * 共和町教育委員会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.kyowa.hokkaido.jp/education/?content=91
 */

export const BASE_URL = "https://www.town.kyowa.hokkaido.jp";

/** 一覧トップページ (教育委員会会議録) */
export const INDEX_CONTENT_ID = "91";

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
    console.warn(`[kyowa] fetchPage failed: ${url}`, e);
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
    console.warn(`[kyowa] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/** content ID からページ URL を組み立てる */
export function buildContentUrl(contentId: string): string {
  return `${BASE_URL}/education/?content=${contentId}`;
}

/**
 * 和暦の日付文字列（例: 令和6年4月25日）を YYYY-MM-DD に変換する。
 * 元年（令和元年 / 平成元年）にも対応。
 * 解析できない場合は null を返す。
 */
export function parseWarekiDate(dateStr: string): string | null {
  const m = dateStr.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!m) return null;

  const era = m[1]!;
  const eraYearStr = m[2]!;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  const month = parseInt(m[3]!, 10);
  const day = parseInt(m[4]!, 10);

  let year: number;
  if (era === "令和") {
    year = 2018 + eraYear;
  } else {
    // 平成
    year = 1988 + eraYear;
  }

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 相対パスの PDF URL を絶対 URL に変換する。
 * 既に絶対 URL の場合はそのまま返す。
 */
export function resolveUrl(href: string, basePageUrl: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  // /assets/... の絶対パス
  if (href.startsWith("/")) {
    return `${BASE_URL}${href}`;
  }
  // 相対パス (../../assets/...) → BASE_URL 基準で解決
  try {
    return new URL(href, basePageUrl).toString();
  } catch {
    return href;
  }
}
