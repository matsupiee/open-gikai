/**
 * 上富良野町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.kamifurano.hokkaido.jp/index.php?id=114
 */

export const BASE_URL = "https://www.town.kamifurano.hokkaido.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 各一覧ページの page id
 * 152: 本会議、153: 予算特別委員会、154: 決算特別委員会
 */
export const LIST_PAGE_IDS = [152, 153, 154] as const;
export type ListPageId = (typeof LIST_PAGE_IDS)[number];

/** 一覧ページのIDから会議種別を返す */
export function listPageIdToMeetingType(pageId: ListPageId): string {
  if (pageId === 152) return "plenary";
  if (pageId === 153) return "committee";
  if (pageId === 154) return "committee";
  return "plenary";
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[kamifurano] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリを返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[kamifurano] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/** 一覧ページの URL を組み立てる */
export function buildListUrl(pageId: ListPageId, page?: number): string {
  if (page && page > 1) {
    return `${BASE_URL}/index.php?id=${pageId}&dpgndg1=${page}`;
  }
  return `${BASE_URL}/index.php?id=${pageId}`;
}

/**
 * 和暦の年号 + 年数を西暦に変換する
 * r = 令和（2019年〜）、h = 平成（1989〜2018年）
 */
export function warekiToSeireki(era: string, year: number): number {
  const eraLower = era.toLowerCase();
  if (eraLower === "r") return 2018 + year;
  if (eraLower === "h") return 1988 + year;
  return year;
}

/**
 * 和暦の日付文字列（例: R07/3/11、H14/11/1）を YYYY-MM-DD に変換する。
 * 解析できない場合は null を返す。
 */
export function parseWarekiDate(dateStr: string): string | null {
  // R07/3/11 or H14/11/1 形式
  const m = dateStr.match(/^([RrHh])(\d{1,2})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return null;
  const era = m[1]!;
  const eraYear = parseInt(m[2]!, 10);
  const month = parseInt(m[3]!, 10);
  const day = parseInt(m[4]!, 10);
  const year = warekiToSeireki(era, eraYear);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
