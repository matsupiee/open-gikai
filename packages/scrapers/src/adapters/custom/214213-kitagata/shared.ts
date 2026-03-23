/**
 * 北方町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.kitagata.gifu.jp/soshiki/gikai/1/2/2/index.html
 * PDF ベースの議事録公開。年度別ページから PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.town.kitagata.gifu.jp";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別ページ ID のマッピング。
 * ページ ID は連番ではないためハードコードする。
 */
export const YEAR_PAGE_ID_MAP: Record<number, number> = {
  2025: 3329,
  2024: 386,
  2023: 385,
  2022: 384,
  2021: 414,
  2020: 413,
  2019: 412,
  // 平成31年 = 2019年（1月〜4月）のみ。令和元年と重複するため省略
  2018: 410,
  2017: 424,
  2016: 423,
  2015: 422,
  2014: 421,
  2013: 420,
  2012: 419,
  2011: 418,
  2010: 417,
  2009: 416,
  2008: 415,
};

/** 年度別ページの URL を返す */
export function buildYearPageUrl(year: number): string | null {
  const pageId = YEAR_PAGE_ID_MAP[year];
  if (!pageId) return null;
  return `${BASE_ORIGIN}/soshiki/gikai/1/2/2/${pageId}.html`;
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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
    const res = await fetch(url, { signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS) });
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
 * 和暦日付テキストから YYYY-MM-DD を返す。
 * e.g., "令和6年9月2日" → "2024-09-02"
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

/**
 * PDF URL からファイル名を抽出して externalId 用のキーを返す。
 * e.g., "/material/files/group/12/r60901gijiroku.pdf" → "r60901gijiroku"
 */
export function extractExternalIdKey(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/]+)\.pdf$/i);
  return match?.[1] ?? null;
}
