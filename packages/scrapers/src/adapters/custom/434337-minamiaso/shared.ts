/**
 * 南阿蘇村議会 — 共通ユーティリティ
 *
 * サイト: https://www.vill.minamiaso.lg.jp/
 * PDF ベースの議事録公開。年度別ページに詳細ページリンクを掲載し、
 * 詳細ページから PDF URL を取得する 2 段階構造。
 */

export const BASE_ORIGIN = "https://www.vill.minamiaso.lg.jp";

/** 会議録メイン一覧ページ（全年度の一覧ページへのリンクが含まれる） */
export const MAIN_LIST_URL = `${BASE_ORIGIN}/gikai/list00576.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(sessionName: string): string {
  if (sessionName.includes("臨時")) return "extraordinary";
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
 * 相対 URL または絶対 URL を BASE_ORIGIN を基準に絶対 URL へ変換する。
 * protocol-relative URL（//example.com/path）にも対応する。
 */
export function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http")) return href;
  // protocol-relative: //www.vill.minamiaso.lg.jp/...
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return `${BASE_ORIGIN}/gikai/${href}`;
}
