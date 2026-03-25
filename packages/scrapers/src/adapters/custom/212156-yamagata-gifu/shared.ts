/**
 * 岐阜県山県市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.yamagata.gifu.jp/site/gikai/list59.html
 * 自治体コード: 212156
 *
 * 全会議録は PDF ファイルで提供される。
 * 会議録一覧ページから年度別ページを取得し、各年度ページから PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.city.yamagata.gifu.jp";
export const LIST_PAGE_URL = `${BASE_ORIGIN}/site/gikai/list59.html`;

/**
 * 年度別ページ URL マップ（静的リスト）
 * ページ構造が安定しているため静的に保持する。
 */
export const YEAR_PAGE_MAP: Record<number, string> = {
  2025: `${BASE_ORIGIN}/site/gikai/50179.html`,
  2024: `${BASE_ORIGIN}/site/gikai/43611.html`,
  2023: `${BASE_ORIGIN}/site/gikai/37094.html`,
  2022: `${BASE_ORIGIN}/site/gikai/27201.html`,
  2021: `${BASE_ORIGIN}/site/gikai/22884.html`,
  2020: `${BASE_ORIGIN}/site/gikai/9991.html`,
  2019: `${BASE_ORIGIN}/site/gikai/4001.html`,
  2018: `${BASE_ORIGIN}/site/gikai/1780.html`,
  2017: `${BASE_ORIGIN}/site/gikai/1794.html`,
  2016: `${BASE_ORIGIN}/site/gikai/1793.html`,
  2015: `${BASE_ORIGIN}/site/gikai/1791.html`,
  2014: `${BASE_ORIGIN}/site/gikai/1790.html`,
  2013: `${BASE_ORIGIN}/site/gikai/1789.html`,
  2012: `${BASE_ORIGIN}/site/gikai/1788.html`,
  2011: `${BASE_ORIGIN}/site/gikai/1792.html`,
  2010: `${BASE_ORIGIN}/site/gikai/1781.html`,
  2009: `${BASE_ORIGIN}/site/gikai/1782.html`,
  2008: `${BASE_ORIGIN}/site/gikai/1783.html`,
  2007: `${BASE_ORIGIN}/site/gikai/1784.html`,
  2006: `${BASE_ORIGIN}/site/gikai/1785.html`,
  2005: `${BASE_ORIGIN}/site/gikai/1786.html`,
  2004: `${BASE_ORIGIN}/site/gikai/1787.html`,
};

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
 * e.g., "令和7年" → 2025, "令和元年" → 2019, "平成31年" → 2019
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
 * 会議種別を検出する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}
