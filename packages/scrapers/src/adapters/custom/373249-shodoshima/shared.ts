/**
 * 小豆島町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/index.html
 * 年別リンク形式。会議録はすべて PDF ファイル。
 */

export const BASE_ORIGIN = "https://www.town.shodoshima.lg.jp";
export const INDEX_URL = `${BASE_ORIGIN}/gyousei/choseijoho/gikai/kaigiroku/index.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議種別テキストから meetingType を判定 */
export function detectMeetingType(sessionType: string): string {
  if (sessionType.includes("臨時")) return "extraordinary";
  if (sessionType.includes("委員会")) return "committee";
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
  } catch (err) {
    console.warn(
      `[373249-shodoshima] fetch 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
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
  } catch (err) {
    console.warn(
      `[373249-shodoshima] fetchBinary 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/material/files/group/20/R603kaigiroku1.pdf" → "R603kaigiroku1"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}

/**
 * プロトコル相対 URL に https: を補完し、絶対 URL に変換する。
 * e.g., "//www.town.shodoshima.lg.jp/material/..." → "https://www.town.shodoshima.lg.jp/material/..."
 * e.g., "/material/..." → "https://www.town.shodoshima.lg.jp/material/..."
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("//")) {
    return `https:${href}`;
  }
  if (href.startsWith("/")) {
    return `${BASE_ORIGIN}${href}`;
  }
  if (href.startsWith("http")) {
    return href;
  }
  return `${BASE_ORIGIN}/${href}`;
}
