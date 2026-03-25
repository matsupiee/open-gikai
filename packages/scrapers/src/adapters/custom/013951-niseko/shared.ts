/**
 * ニセコ町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.niseko.lg.jp/chosei/gikai/kaigi
 * 自治体コード: 013951
 *
 * 全会議録は PDF ファイルで提供される。
 * 年度別ページから PDF リンクを収集する方式。
 */

export const BASE_ORIGIN = "https://www.town.niseko.lg.jp";
export const LIST_PAGE_URL = `${BASE_ORIGIN}/chosei/gikai/kaigi`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[013951-niseko] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`[013951-niseko] fetchPage error: ${url}`, e instanceof Error ? e.message : e);
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
      console.warn(`[013951-niseko] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[013951-niseko] fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 和暦テキストから西暦年を返す。
 * 例: "令和7年" → 2025, "令和元年" → 2019, "平成31年" → 2019
 */
export function eraToWesternYear(eraText: string): number | null {
  const match = eraText.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, yearPart] = match;
  const eraYear = yearPart === "元" ? 1 : parseInt(yearPart!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 西暦年から年度別ページの年号パスを返す。
 * 例: 2024 → "r06", 2019 → "h31", 2027 → "r09"
 */
export function yearToEraPath(year: number): string | null {
  if (year >= 2019) {
    const reiwaYear = year - 2018;
    return `r${String(reiwaYear).padStart(2, "0")}`;
  }
  if (year >= 1989) {
    const heiseiYear = year - 1988;
    return `h${String(heiseiYear).padStart(2, "0")}`;
  }
  return null;
}

/**
 * 会議種別を検出する。
 */
export function detectMeetingType(title: string): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
