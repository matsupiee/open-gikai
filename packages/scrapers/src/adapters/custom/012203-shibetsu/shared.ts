/**
 * 士別市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.shibetsu.lg.jp/soshikikarasagasu/gikaijimukyoku/kaigirokukennsaku/index.html
 * 自治体コード: 012203
 *
 * 全会議録は PDF ファイルで提供される。
 * 年度別ページに h2/h3/h4 構造で PDF リンクが掲載されている。
 */

export const BASE_ORIGIN = "https://www.city.shibetsu.lg.jp";

export const INDEX_URL =
  `${BASE_ORIGIN}/soshikikarasagasu/gikaijimukyoku/kaigirokukennsaku/index.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 年度別ページの定義 */
export const YEAR_PAGE_IDS: Record<number, string> = {
  2025: "6642", // 令和7年
  2024: "6431", // 令和6年
  2023: "4813", // 令和5年
  2022: "3802", // 令和4年
  2021: "832",  // 令和3年
  2020: "830",  // 令和2年
  2019: "804",  // 令和元・平成31年
};

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
const PDF_FETCH_TIMEOUT_MS = 60_000;

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
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
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
 * 日付テキストから YYYY-MM-DD を返す。null は解析失敗を示す。
 *
 * 対応パターン:
 *   "令和7年3月4日" → "2025-03-04"
 *   "令和元年6月10日" → "2019-06-10"
 *   "平成31年3月" → "2019-03-01"
 */
export function parseDateFromText(text: string): string | null {
  // 年月日パターン
  const fullMatch = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (fullMatch) {
    const year = eraToWesternYear(`${fullMatch[1]}${fullMatch[2]}年`);
    if (!year) return null;
    const month = parseInt(fullMatch[3]!, 10);
    const day = parseInt(fullMatch[4]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 年月パターン（日なし）
  const monthMatch = text.match(/(令和|平成)(元|\d+)年(\d+)月/);
  if (monthMatch) {
    const year = eraToWesternYear(`${monthMatch[1]}${monthMatch[2]}年`);
    if (!year) return null;
    const month = parseInt(monthMatch[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * 会議種別タイトルから meetingType を推定する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}
