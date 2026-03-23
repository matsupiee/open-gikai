/**
 * 橋本市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/index.html
 * 自治体コード: 302031
 * SMART CMS ベース。年度フォルダ構造で PDF 会議録を公開。
 */

export const BASE_ORIGIN = "https://www.city.hashimoto.lg.jp";

export const BASE_PATH = "/shigikai/kaigiannai/kaigiroku";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 西暦年から年度フォルダ名を返す。
 * 年度フォルダ名は不規則なので固定リストで管理する。
 * year は西暦の年（例: 2025）で、対応する和暦年度のフォルダを返す。
 *
 * 注意: year=2025 は令和7年度 → R7kaigiroku
 *       year=2026 は令和8年度 → R7kaigiroku_1（令和8年=R7+1 の命名）
 */
const YEAR_FOLDER_MAP: Record<number, string> = {
  2026: "R7kaigiroku_1",
  2025: "R7kaigiroku",
  2024: "R6kaigiroku",
  2023: "R5kaigiroku",
  2022: "R4kaigiroku",
  2021: "R3kaigiroku",
  2020: "R2",
  2019: "h31",
  2018: "h30",
  2017: "H29",
  2016: "H28",
  2015: "H27",
  2014: "H26",
  2013: "h25",
  2012: "h24",
  2011: "h23",
};

export function getYearFolder(year: number): string | null {
  return YEAR_FOLDER_MAP[year] ?? null;
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
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** 年度一覧ページの URL を構築する */
export function buildYearPageUrl(folder: string): string {
  return `${BASE_ORIGIN}${BASE_PATH}/${folder}/index.html`;
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/material/files/group/27/2025-0225.pdf" → "2025-0225"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}
