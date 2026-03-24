/**
 * 那珂川町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.tochigi-nakagawa.lg.jp/05gikai/kaigiroku/
 * PDF ベースの議事録公開。年別にページが分かれており、各詳細ページから PDF リンクを取得する。
 * 会議録は平成21年（2009年）から令和7年（2025年）まで掲載。
 */

export const BASE_ORIGIN = "https://www.town.tochigi-nakagawa.lg.jp";

/** 会議録トップページの URL */
export const TOP_PAGE_URL = `${BASE_ORIGIN}/05gikai/kaigiroku/`;

/** 年別一覧の範囲 */
export const YEAR_RANGE = { from: 2009, to: 2025 };

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

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
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.warn(
      `[094111-nakagawa-tochigi] fetchPage 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
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
  } catch (err) {
    console.warn(
      `[094111-nakagawa-tochigi] fetchBinary 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * 和暦の年月日を YYYY-MM-DD に変換する。
 * e.g., "令和6年12月3日" → "2024-12-03"
 *       "令和元年5月1日" → "2019-05-01"
 *       "平成21年3月1日" → "2009-03-01"
 */
export function parseJapaneseDate(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
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
 * 月日のみのテキストと西暦年を組み合わせて YYYY-MM-DD に変換する。
 * e.g., "12月3日" + 2024 → "2024-12-03"
 */
export function parseMonthDay(text: string, year: number): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(\d+)月(\d+)日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年別一覧ページの URL を生成する。
 * e.g., 2024 → "https://www.town.tochigi-nakagawa.lg.jp/05gikai/kaigiroku/2024/index.html"
 */
export function buildYearListUrl(year: number): string {
  return `${BASE_ORIGIN}/05gikai/kaigiroku/${year}/index.html`;
}
