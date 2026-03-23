/**
 * 広川町議会（福岡県） — 共通ユーティリティ
 *
 * サイト: https://www.town.hirokawa.fukuoka.jp/soshiki/gikai_jimukyoku/1/1/1/1/index.html
 * Joruri CMS ベースの公式サイト。年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.town.hirokawa.fukuoka.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度ディレクトリのマッピング。
 * 令和4年度(2022) = 5_2, 令和5年度(2023) = 5_3, ...
 * 西暦年度から計算: 5_{year - 2020}
 */
export function buildYearDirId(fiscalYear: number): string {
  return `5_${fiscalYear - 2020}`;
}

/**
 * 西暦年から年度一覧ページの URL を構築する。
 * year は会計年度（4月始まり）の開始年を想定。
 */
export function buildListUrl(baseUrl: string, fiscalYear: number): string {
  const dirId = buildYearDirId(fiscalYear);
  // baseUrl は index.html を含む可能性がある
  const base = baseUrl.replace(/\/index\.html$/, "");
  return `${base}/${dirId}/index.html`;
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("委員")) return "committee";
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

/**
 * 和暦テキストから YYYY-MM-DD を返す。
 * 「令和6年3月4日」→ "2024-03-04"
 * 「令和元年6月1日」→ "2019-06-01"
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
