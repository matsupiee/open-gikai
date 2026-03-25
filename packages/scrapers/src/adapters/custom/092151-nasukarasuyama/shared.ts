/**
 * 那須烏山市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.nasukarasuyama.lg.jp/city-council/minutes/index.html
 * PDF ベースの議事録公開。市公式サイトに PDF 形式で直接掲載。
 */

export const BASE_ORIGIN = "https://www.city.nasukarasuyama.lg.jp";

/** 会議録一覧ページの URL */
export const INDEX_PAGE_URL = `${BASE_ORIGIN}/city-council/minutes/index.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

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
      `[092151-nasukarasuyama] fetchPage 失敗: ${url}`,
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
      `[092151-nasukarasuyama] fetchBinary 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * 和暦の年月日を YYYY-MM-DD に変換する。
 * e.g., "令和7年11月28日" → "2025-11-28"
 *       "令和元年5月1日"  → "2019-05-01"
 *       "平成31年4月1日"  → "2019-04-01"
 * 全角数字にも対応する。
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

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}
