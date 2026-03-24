/**
 * 枕崎市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.makurazaki.lg.jp/site/gikai/5672.html
 * 自治体コード: 462047
 *
 * 年度別 PDF サイト。会議録トップ → 年度別ページ → PDF の 2 階層構造。
 */

export const BASE_ORIGIN = "https://www.city.makurazaki.lg.jp";

/** 会議録トップページ */
export const TOP_PAGE_URL = `${BASE_ORIGIN}/site/gikai/5672.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別ページ ID のマッピング（ハードコード）
 * キーは西暦年（令和6年分 = 2024 等）
 */
export const YEAR_PAGE_IDS: ReadonlyArray<{ year: number; pageId: number }> = [
  { year: 2025, pageId: 26810 },
  { year: 2024, pageId: 24214 },
  { year: 2023, pageId: 22059 },
  { year: 2022, pageId: 19874 },
  { year: 2021, pageId: 17230 },
  { year: 2020, pageId: 14452 },
  { year: 2019, pageId: 11339 },
  { year: 2018, pageId: 9686 },
  { year: 2017, pageId: 6910 },
  { year: 2016, pageId: 403 },
  { year: 2015, pageId: 5666 },
  { year: 2014, pageId: 5665 },
  { year: 2013, pageId: 5667 },
  { year: 2012, pageId: 5668 },
  { year: 2011, pageId: 5669 },
  { year: 2010, pageId: 5670 },
];

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[462047-makurazaki] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[462047-makurazaki] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
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
      console.warn(`[462047-makurazaki] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[462047-makurazaki] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6年" → 2024, "平成30年" → 2018, "令和元年" → 2019
 * 変換できない場合は null を返す。
 */
export function eraToWesternYear(era: string, yearInEra: number): number | null {
  if (era === "令和") return yearInEra + 2018;
  if (era === "平成") return yearInEra + 1988;
  if (era === "昭和") return yearInEra + 1925;
  return null;
}

/**
 * 日本語の日付文字列から YYYY-MM-DD を抽出する。
 * 例: "令和6年2月8日" → "2024-02-08"
 * 変換できない場合は null を返す（フォールバック禁止）。
 */
export function parseJapaneseDate(text: string): string | null {
  const m = text.match(/(令和|平成|昭和)(元|\d+)年(\d+)月(\d+)日/);
  if (!m) return null;
  const yearInEra = m[2] === "元" ? 1 : parseInt(m[2]!, 10);
  const westernYear = eraToWesternYear(m[1]!, yearInEra);
  if (westernYear === null) return null;
  const month = parseInt(m[3]!, 10);
  const day = parseInt(m[4]!, 10);
  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** 年度別ページ URL を組み立てる */
export function buildYearPageUrl(pageId: number): string {
  return `${BASE_ORIGIN}/site/gikai/${pageId}.html`;
}
