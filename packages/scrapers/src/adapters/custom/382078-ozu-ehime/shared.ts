/**
 * 大洲市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.ozu.ehime.jp/kaigiroku/index.html
 * 自治体コード: 382078
 *
 * フレームセット構造。年度別静的 HTML ファイルで管理。
 * 年度インデックス (y{N}.html) は Shift-JIS エンコード。
 * 会議録本文 (平成20年以降) は UTF-8 エンコード。
 * 平成17〜18年は PDF 形式（対応外）。
 */

export const BASE_URL = "https://www.city.ozu.ehime.jp/kaigiroku";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦年号と年数から西暦を計算する。
 * 「元」は 1 として扱う。
 */
export function toSeireki(gengo: string, nenStr: string): number {
  const nen = nenStr === "元" ? 1 : parseInt(nenStr, 10);
  if (gengo === "令和") return 2018 + nen;
  if (gengo === "平成") return 1988 + nen;
  if (gengo === "昭和") return 1925 + nen;
  return NaN;
}

/**
 * 年から年度インデックス番号を計算する。
 * 年度ファイルは 2005年(平成17年)=y05.html から始まる。
 * ファイル番号 = 西暦年 - 2000
 */
export function yearToIndexNum(year: number): number {
  return year - 2000;
}

/**
 * 年度インデックスページの URL を返す。
 */
export function buildIndexUrl(year: number): string {
  const num = yearToIndexNum(year);
  return `${BASE_URL}/y${String(num).padStart(2, "0")}.html`;
}

/** fetch して Shift-JIS テキストを返す */
export async function fetchPageShiftJis(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    return new TextDecoder("shift_jis").decode(buffer);
  } catch (err) {
    console.warn(`[ozu-ehime] fetchPageShiftJis failed: ${url}`, err);
    return null;
  }
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
  } catch (err) {
    console.warn(`[ozu-ehime] fetchPage failed: ${url}`, err);
    return null;
  }
}
