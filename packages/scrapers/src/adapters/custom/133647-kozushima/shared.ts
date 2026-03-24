/**
 * 神津島村議会 — 共通ユーティリティ
 *
 * サイト: https://www.vill.kouzushima.tokyo.jp/busyo/gikai/
 * WordPress による PDF 公開。カテゴリ一覧を全ページ巡回して会議録を収集する。
 */

export const BASE_ORIGIN = "https://www.vill.kouzushima.tokyo.jp";
export const CATEGORY_BASE_URL =
  "https://www.vill.kouzushima.tokyo.jp/category/gikai/";

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
 * 和暦テキストから西暦年を返す。
 * e.g., "令和7年" → 2025, "令和6年" → 2024
 */
export function parseEraYear(text: string): number | null {
  const reiwaMatch = text.match(/令和(\d+)年/);
  if (reiwaMatch) return Number(reiwaMatch[1]) + 2018;

  const heiseiMatch = text.match(/平成(\d+)年/);
  if (heiseiMatch) return Number(heiseiMatch[1]) + 1988;

  return null;
}
