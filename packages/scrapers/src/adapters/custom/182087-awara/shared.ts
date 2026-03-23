/**
 * あわら市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.awara.lg.jp/gikai/kaigiroku/index.html
 * 自治体コード: 182087
 *
 * PDF ベースの議事録公開。年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.city.awara.lg.jp";
export const BASE_PATH = "/gikai/kaigiroku";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 西暦年 → 年度別ページ URL のマッピング。
 * トップページのリンクは固定のためハードコードする。
 */
export const YEAR_PAGE_MAP: Record<number, string> = {
  2025: `${BASE_PATH}/p014799.html`,
  2024: `${BASE_PATH}/p014488.html`,
  2023: `${BASE_PATH}/p013367.html`,
  2022: `${BASE_PATH}/p012867.html`,
  2021: `${BASE_PATH}/p012497.html`,
  2020: `${BASE_PATH}/p011421.html`,
  2019: `${BASE_PATH}/p010075.html`,
  2018: `${BASE_PATH}/30kaigiroku.html`,
  2017: `${BASE_PATH}/29kaigiroku.html`,
  2016: `${BASE_PATH}/28kaigiroku.html`,
  2015: `${BASE_PATH}/27kaigiroku.html`,
  2014: `${BASE_PATH}/p004992.html`,
  2013: `${BASE_PATH}/p004381.html`,
  2012: `${BASE_PATH}/p003740.html`,
  2011: `${BASE_PATH}/p002808.html`,
  2010: `${BASE_PATH}/p001810.html`,
  2009: `${BASE_PATH}/p001172.html`,
  2008: `${BASE_PATH}/p000957.html`,
  2007: `${BASE_PATH}/p000956.html`,
  2006: `${BASE_PATH}/p000955.html`,
  2005: `${BASE_PATH}/p000951.html`,
  2004: `${BASE_PATH}/p000958.html`,
};

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
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
 * 年度ページパスから PDF のベース URL を構築する。
 * 例: "/gikai/kaigiroku/p014488.html" → "https://www.city.awara.lg.jp/gikai/kaigiroku/p014488_d/fil/"
 * 例: "/gikai/kaigiroku/30kaigiroku.html" → "https://www.city.awara.lg.jp/gikai/kaigiroku/30kaigiroku_d/fil/"
 */
export function buildPdfBaseUrl(pagePath: string): string {
  const withoutExt = pagePath.replace(/\.html$/, "");
  return `${BASE_ORIGIN}${withoutExt}_d/fil/`;
}

/** バイナリデータを取得する */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * リンクテキスト（例: "3月定例会"）から月を抽出し、
 * 年と組み合わせて YYYY-MM-01 形式の日付文字列を返す。
 * 月が抽出できない場合は空文字列を返す。
 */
export function buildHeldOn(linkText: string, year: number): string {
  const m = linkText.match(/(\d{1,2})月/);
  if (!m) return "";
  const month = parseInt(m[1]!, 10);
  if (month < 1 || month > 12) return "";
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
