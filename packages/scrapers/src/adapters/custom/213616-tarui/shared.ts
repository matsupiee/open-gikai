/**
 * 垂井町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.tarui.lg.jp/site/gikai/list32.html
 * PDF ベースの議事録公開。年度別ページから PDF リンクを直接取得。
 */

export const BASE_ORIGIN = "https://www.town.tarui.lg.jp";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別一覧ページの URL マッピング
 * インデックスページ: https://www.town.tarui.lg.jp/site/gikai/list32.html
 */
const YEAR_PAGE_MAP: Record<number, string> = {
  2025: "/site/gikai/13807.html",
  2024: "/site/gikai/10347.html",
  2023: "/site/gikai/7139.html",
  2022: "/site/gikai/4300.html",
  2021: "/site/gikai/4301.html",
  2020: "/site/gikai/4302.html",
  2019: "/site/gikai/4303.html",
  // 平成26〜30年 (2014-2018)
  2018: "/page/4304.html",
  2017: "/page/4304.html",
  2016: "/page/4304.html",
  2015: "/page/4304.html",
  2014: "/page/4304.html",
  // 平成21〜25年 (2009-2013)
  2013: "/page/4305.html",
  2012: "/page/4305.html",
  2011: "/page/4305.html",
  2010: "/page/4305.html",
  2009: "/page/4305.html",
};

/** 年度別一覧ページの URL を返す。複数年がまとめられているページも含む。 */
export function buildYearPageUrl(year: number): string | null {
  const path = YEAR_PAGE_MAP[year];
  if (!path) return null;
  return `${BASE_ORIGIN}${path}`;
}

/** 会議タイプを検出する */
export function detectMeetingType(sessionTitle: string): string {
  if (sessionTitle.includes("臨時")) return "extraordinary";
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
 * e.g., "令和６年12月11日" → "2024-12-11"
 * 全角数字も対応する。
 */
export function parseDateText(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
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
 * PDF URL から externalId 用のキーを抽出する。
 * e.g., "/uploaded/attachment/12345.pdf" → "12345"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/uploaded\/attachment\/(\d+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}
