/**
 * 羽幌町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.haboro.lg.jp/gikai-iinkai/gikai/gijiroku/
 * PDF + HTML 混在。平成25年以降は PDF、平成18年〜24年は HTML。
 */

export const BASE_ORIGIN = "https://www.town.haboro.lg.jp";
export const BASE_PATH = "/gikai-iinkai/gikai/gijiroku/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別ページの URL マッピング。
 * URL パターンが統一されていないため、年度ごとにハードコードする。
 */
export const YEAR_PAGE_MAP: Record<number, { path: string; format: "pdf" | "html" }> = {
  2025: { path: "2025-0610-1529-17.html", format: "pdf" },
  2024: { path: "R06kaigiroku.html", format: "pdf" },
  2023: { path: "R05kaigi.html", format: "pdf" },
  2022: { path: "2022-0520-1034-40.html", format: "pdf" },
  2021: { path: "R03gijiroku.html", format: "pdf" },
  2020: { path: "R02gijiroku.html", format: "pdf" },
  2019: { path: "H31.html", format: "pdf" },
  2018: { path: "h30/index.html", format: "pdf" },
  2017: { path: "H29/index.html", format: "pdf" },
  2016: { path: "H28/index.html", format: "pdf" },
  2015: { path: "H27/index.html", format: "pdf" },
  2014: { path: "H26/index.html", format: "pdf" },
  2013: { path: "h25/index.html", format: "pdf" },
  2012: { path: "h24/", format: "html" },
  2011: { path: "h23/index.html", format: "html" },
  2010: { path: "h22/index.html", format: "html" },
  2009: { path: "h21/index.html", format: "html" },
  2008: { path: "h20/index.html", format: "html" },
  2007: { path: "h19/index.html", format: "html" },
  2006: { path: "h18/index.html", format: "html" },
};

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (/臨時/.test(title)) return "extraordinary";
  if (/委員会/.test(title)) return "committee";
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

/** 年度ページの完全 URL を構築する */
export function buildYearPageUrl(year: number): string | null {
  const entry = YEAR_PAGE_MAP[year];
  if (!entry) return null;
  return `${BASE_ORIGIN}${BASE_PATH}${entry.path}`;
}

/**
 * 和暦テキストから YYYY-MM-DD を返す。
 * 「元年」にも対応する。
 */
export function parseDateText(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
