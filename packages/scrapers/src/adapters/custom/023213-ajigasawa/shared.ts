/**
 * 鰺ヶ沢町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.ajigasawa.lg.jp/about_town/gikai/gikai-kaigiroku.html
 * 単一ページに全年度の PDF リンクが掲載されている。
 */

export const BASE_ORIGIN = "https://www.town.ajigasawa.lg.jp";

export const LIST_URL =
  "https://www.town.ajigasawa.lg.jp/about_town/gikai/gikai-kaigiroku.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
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
 * 西暦年を和暦年（令和N）に変換する。
 * e.g., 2025 → 7, 2026 → 8
 */
export function toReiwaYear(year: number): number {
  return year - 2018;
}

/**
 * PDF ファイル名から externalId 用のキーを抽出する。
 * e.g., "gikai-kaigiroku.files/0704-teirei.pdf" → "0704-teirei"
 */
export function extractExternalIdKey(href: string): string | null {
  const match = href.match(/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}
