/**
 * 北川村議会 — 共通ユーティリティ
 *
 * サイト: https://www.kitagawamura.jp/life/list.php?hdnSKBN=B&hdnCat=800
 * PDF ベースの議会情報公開（会期日程・審議結果）。
 */

export const BASE_ORIGIN = "https://www.kitagawamura.jp";

/** 議会カテゴリ一覧 URL */
export const LIST_URL = `${BASE_ORIGIN}/life/list.php?hdnSKBN=B&hdnCat=800`;

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
 * 詳細ページの URL を組み立てる。
 * e.g., "/life/dtl.php?hdnKey=123" → "https://www.kitagawamura.jp/life/dtl.php?hdnKey=123"
 */
export function buildDetailUrl(hdnKey: string): string {
  return `${BASE_ORIGIN}/life/dtl.php?hdnKey=${hdnKey}`;
}
