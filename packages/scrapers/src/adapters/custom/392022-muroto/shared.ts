/**
 * 室戸市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.muroto.kochi.jp/navi/a02b08.php
 * PDF ベースの議会情報公開（年別ページ経由で会議録 PDF を直接配布）。
 */

export const BASE_ORIGIN = "https://www.city.muroto.kochi.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 年別ページ ID マッピング（西暦 → ページ ID） */
export const YEAR_PAGE_MAP: Record<number, string> = {
  2025: "3221", // 令和7年
  2024: "2899", // 令和6年
  2023: "2554", // 令和5年
  2022: "2136", // 令和4年
  2021: "1708", // 令和3年
  2020: "1294", // 令和2年
  2019: "0974", // 平成31年/令和元年
  2018: "0981", // 平成30年
  2017: "0987", // 平成29年
  2016: "0997", // 平成28年
  2015: "1003", // 平成27年
  2014: "1023", // 平成26年
  2013: "1031", // 平成25年
  2012: "1042", // 平成24年
  2011: "1047", // 平成23年
  2010: "1053", // 平成22年
  2009: "0952", // 平成21年
};

/** 年別ページ URL を構築 */
export function buildYearPageUrl(year: number): string | null {
  const pageId = YEAR_PAGE_MAP[year];
  if (!pageId) return null;
  return `${BASE_ORIGIN}/pages/page${pageId}.php`;
}

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

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/pbfile/m003221/pbf20250606112145_C0AMALt2V4VD.pdf" → "m003221_pbf20250606112145_C0AMALt2V4VD"
 */
export function extractExternalIdKey(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/(m\d+)\/(pbf[^/]+)\.pdf$/i);
  if (!match) return null;
  return `${match[1]}_${match[2]}`;
}
