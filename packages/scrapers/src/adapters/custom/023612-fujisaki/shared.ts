/**
 * 藤崎町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.fujisaki.lg.jp/index.cfm/9,17429,html
 * ColdFusion CMS で会議録を PDF 公開。年度ごとに ContentID ベースの URL。
 */

export const BASE_ORIGIN = "https://www.town.fujisaki.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 年度別ページの ContentID マッピング。
 * 西暦年（年度の開始年）→ URL パス。
 */
const YEAR_PAGE_MAP: Record<number, string> = {
  2009: "/index.cfm/9,1213,83,221,html",
  2010: "/index.cfm/9,1212,83,221,html",
  2011: "/index.cfm/9,1276,83,221,html",
  2012: "/index.cfm/9,4246,83,221,html",
  2013: "/index.cfm/9,4388,83,221,html",
  2014: "/index.cfm/9,5230,83,221,html",
  2015: "/index.cfm/9,6107,83,221,html",
  2016: "/index.cfm/9,7319,83,221,html",
  2017: "/index.cfm/9,8777,83,221,html",
  2018: "/index.cfm/9,10010,83,221,html",
  2019: "/index.cfm/9,11186,83,221,html",
  2020: "/index.cfm/9,12539,83,221,html",
  2021: "/index.cfm/9,14290,83,221,html",
  2022: "/index.cfm/9,15736,83,221,html",
  2023: "/index.cfm/9,17429,83,221,html",
  2024: "/index.cfm/9,18933,83,221,html",
  2025: "/index.cfm/9,20469,83,221,html",
  2026: "/index.cfm/9,21976,83,221,html",
};

/** 年度別ページの URL を構築する */
export function buildYearPageUrl(year: number): string | null {
  const path = YEAR_PAGE_MAP[year];
  if (!path) return null;
  return `${BASE_ORIGIN}${path}`;
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
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
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/index.cfm/9,17429,c,html/17429/20230222-092339.pdf" → "17429_20230222-092339"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/(\d+)\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `${match[1]}_${match[2]}`;
}
