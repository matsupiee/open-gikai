/**
 * 釧路町議会 会議録 — 共通ユーティリティ
 *
 * サイト: http://www.town.kushiro.lg.jp/gikai/
 * 自治体コード: 016616
 *
 * 全会議録は PDF ファイルで提供される。
 * 年度別一覧ページ → 会議録詳細ページ → PDF の3段階クロール。
 */

export const BASE_ORIGIN = "http://www.town.kushiro.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
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
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和7年" → 2025, "令和元年" → 2019, "平成25年" → 2013
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
 * 全角数字を半角数字に変換する。
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 年度別一覧ページの URL を組み立てる。
 * e.g., year=2024 → "http://www.town.kushiro.lg.jp/gikai/gijiroku/2024.html"
 */
export function buildYearListUrl(year: number): string {
  return `${BASE_ORIGIN}/gikai/gijiroku/${year}.html`;
}

/**
 * 会議録詳細ページの URL を組み立てる。
 * kind: 1=定例会, 2=臨時会
 * e.g., round=1, kind=1, year=2024 → ".../gijiroku/1/1/2024.html"
 */
export function buildDetailUrl(
  round: number,
  kind: number,
  year: number,
): string {
  return `${BASE_ORIGIN}/gikai/gijiroku/${round}/${kind}/${year}.html`;
}
