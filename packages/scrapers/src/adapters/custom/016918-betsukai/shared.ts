/**
 * 別海町議会 -- 共通ユーティリティ
 *
 * サイト: https://betsukai.jp/gikai/kaigikekka/kaigiroku/
 * PDF ベースの議事録公開。年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://betsukai.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(section: string): string {
  if (section.includes("臨時")) return "extraordinary";
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

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
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
 * 西暦年から年度ページの URL パスコードを返す。
 *
 * - 2019 以降: R01, R02, ... R08
 * - 2018 以前: h30, h29, ... h22
 */
export function yearToEraCode(year: number): string | null {
  if (year >= 2019) {
    const reiwa = year - 2018;
    return `R${String(reiwa).padStart(2, "0")}`;
  }
  if (year >= 2010 && year <= 2018) {
    const heisei = year - 1988;
    return `h${heisei}`;
  }
  return null;
}

/**
 * 年度ページ URL を構築する。
 */
export function buildYearPageUrl(baseUrl: string, year: number): string | null {
  const code = yearToEraCode(year);
  if (!code) return null;
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}${code}/`;
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/resources/output/contents/file/release/6679/80913/R7.4kaigiroku1.pdf"
 *   → "80913_R7.4kaigiroku1"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/(\d+)\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `${match[1]}_${match[2]}`;
}
