/**
 * 下田市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.shimoda.shizuoka.jp/category/090100kaigiroku/index.html
 * PDF ベースの議事録公開。令和元年度以降と平成31年度以前で一覧ページが異なる。
 */

export const BASE_ORIGIN = "https://www.city.shimoda.shizuoka.jp";

/** 令和元年度以降の会議録一覧ページ */
export const REIWA_LIST_PATH = "/category/090100kaigiroku/index.html";
/** 平成31年度以前の会議録一覧ページ */
export const HEISEI_LIST_PATH = "/category/h28_kaigiroku/index.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(section: string): string {
  if (section.includes("委員会")) return "committee";
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
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/file/会議録本文（061205）.pdf" → "会議録本文（061205）"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const decoded = decodeURIComponent(pdfPath);
  const match = decoded.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}
