/**
 * 馬路村議会 — 共通ユーティリティ
 *
 * サイト: https://vill.umaji.lg.jp/about/category/parliament/
 * WordPress サイトで PDF ファイルによる情報公開（会議録検索システムなし）。
 * 会議録（発言録）はオンライン公開なし。議決の状況・一般質問の状況・開催状況を PDF で提供。
 */

export const BASE_ORIGIN = "https://vill.umaji.lg.jp";

/** 議会カテゴリページ URL */
export const CATEGORY_URL = `${BASE_ORIGIN}/about/category/parliament/`;

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
    if (!res.ok) {
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 元号テキストから YYYY-MM-DD を返す。
 * e.g., "令和7年1月20日" → "2025-01-20"
 * e.g., "令和7年3月6日" → "2025-03-06"
 */
export function parseJapaneseDate(text: string): string | null {
  const eraMatch = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!eraMatch) return null;

  const [, era, eraYearStr, monthStr, dayStr] = eraMatch;
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
 * タイトルから年度情報（令和・平成 → 西暦年）を抽出する。
 * e.g., "令和7年第1回臨時会（令和7年1月20日）" → 2025
 */
export function parseYearFromTitle(title: string): number | null {
  const eraMatch = title.match(/(令和|平成)(元|\d+)年/);
  if (!eraMatch) return null;

  const [, era, eraYearStr] = eraMatch;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}
