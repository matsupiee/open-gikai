/**
 * 神戸町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.godo.gifu.jp/contents/gikai/gikai08.html
 * PDF ベースの議事録公開。1ページに全年度の PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.town.godo.gifu.jp";
export const LIST_PATH = "/contents/gikai/gikai08.html";
export const PDF_BASE = "https://www.town.godo.gifu.jp/contents/gikai/";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 西暦年から和暦の年度コードを返す。
 * e.g., 2024 → "r6", 2025 → "r7"
 */
export function toEraCode(year: number): string | null {
  if (year >= 2019) {
    const eraYear = year - 2018;
    return `r${eraYear}`;
  }
  return null;
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
