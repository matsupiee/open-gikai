/**
 * 森町議会（静岡県）— 共通ユーティリティ
 *
 * サイト: https://www.town.morimachi.shizuoka.jp/
 * PDF ベースの議事録公開。年度別ページから PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.town.morimachi.shizuoka.jp";

/** 会議録インデックスページのパス */
export const INDEX_PATH =
  "/gyosei/machinososhiki/gikaijimukyoku/giji_shomugakari/1/2/456.html";

/** 年度別ページのベースパス */
export const YEAR_PAGE_BASE =
  "/gyosei/machinososhiki/gikaijimukyoku/giji_shomugakari/1/2/5/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(section: string): string {
  if (section.includes("委員会")) return "committee";
  if (section.includes("臨時")) return "extraordinary";
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
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 和暦の日付テキストから YYYY-MM-DD 形式に変換する。
 * e.g., "令和7年3月3日" → "2025-03-03"
 *       "令和元年9月5日" → "2019-09-05"
 *       "平成31年3月15日" → "2019-03-15"
 */
export function parseJapaneseDate(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearRaw, month, day] = match;
  const eraYear = eraYearRaw === "元" ? 1 : Number(eraYearRaw);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(Number(month)).padStart(2, "0")}-${String(Number(day)).padStart(2, "0")}`;
}
