/**
 * 宿毛市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.sukumo.kochi.jp/01/04/02/02/
 * PDF ベースの議会情報公開（年別ページ経由で会議録 PDF を直接配布）。
 */

export const BASE_ORIGIN = "https://www.city.sukumo.kochi.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年別ページ URL マッピング（西暦 → パス）
 * 宿毛市は年度別ページの URL 形式が混在しているため固定リストを使用する。
 */
export const YEAR_PAGE_MAP: Record<number, string> = {
  2025: "/docs-06/41914.html", // 令和7年
  2024: "/docs-06/38321.html", // 令和6年
  2023: "/docs-06/34637.html", // 令和5年
  2022: "/docs-06/30850.html", // 令和4年
  2021: "/docs-06/26157.html", // 令和3年
  2020: "/docs-06/19176.html", // 令和2年
  2019: "/docs-06/15367.html", // 平成31年/令和元年
  2018: "/docs-06/P300608-2.html", // 平成30年
  2017: "/docs-06/p01041101.html", // 平成29年
  2016: "/docs-06/p01041102.html", // 平成28年
  2015: "/docs-06/p01041103.html", // 平成27年
  2014: "/docs-06/p01041104.html", // 平成26年
  2013: "/docs-06/p01041105.html", // 平成25年
  2012: "/docs-06/p01041106.html", // 平成24年
  2011: "/docs-06/p01041107.html", // 平成23年
  2010: "/docs-06/p01041108.html", // 平成22年
  2009: "/docs-06/p01041109.html", // 平成21年
  2008: "/docs-06/p01041110.html", // 平成20年
  2007: "/docs-06/p01041111.html", // 平成19年
  2006: "/docs-06/p01041118.html", // 平成18年
  2005: "/docs-06/p01041113.html", // 平成17年
};

/** 年別ページ URL を構築 */
export function buildYearPageUrl(year: number): string | null {
  const path = YEAR_PAGE_MAP[year];
  if (!path) return null;
  return `${BASE_ORIGIN}${path}`;
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦テキストから西暦年に変換する。
 * 元年対応あり。
 *
 * e.g., "令和", 1 → 2019
 *       "平成", "元" → 1989
 */
export function eraToWesternYear(era: string, eraYearStr: string): number | null {
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  if (isNaN(eraYear)) return null;

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
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
