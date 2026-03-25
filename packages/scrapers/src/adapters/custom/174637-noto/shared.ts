/**
 * 能登町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/index.html
 * PDF ベースの議事録公開。年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.town.noto.lg.jp";

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
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/material/files/group/14/R7_1kaigiroku.pdf" -> "14_R7_1kaigiroku"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/(\d+)\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `${match[1]}_${match[2]}`;
}
