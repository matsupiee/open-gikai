/**
 * 有田町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.town.arita.lg.jp/gikai/list00404.html
 * 自治体コード: 414018
 *
 * 有田町は SMART CMS ベースの議会サイトで、年度一覧ページから
 * 実ページ（detail.aspx）へリダイレクトした先に一般質問の PDF を掲載している。
 */

export const BASE_ORIGIN = "https://www.town.arita.lg.jp";
export const INDEX_PATH = "/gikai/list00404.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** 一覧ページ URL を構築する */
export function buildListUrl(path: string = INDEX_PATH): string {
  return new URL(path, BASE_ORIGIN).toString();
}

/** ドキュメント URL を構築する */
export function buildDocumentUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, BASE_ORIGIN).toString();
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

/** fetch して ArrayBuffer を返す（PDF 用） */
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
