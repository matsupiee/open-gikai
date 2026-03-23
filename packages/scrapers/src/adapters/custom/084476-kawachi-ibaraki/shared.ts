/**
 * 河内町議会（茨城県）— 共通ユーティリティ
 *
 * サイト: https://www.town.ibaraki-kawachi.lg.jp/page/dir000122.html
 * 自治体コード: 084476
 */

export const BASE_ORIGIN = "https://www.town.ibaraki-kawachi.lg.jp";

/** 会議録インデックスページ */
export const INDEX_PAGE_URL = `${BASE_ORIGIN}/page/dir000122.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
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
      console.warn(
        `[084476-kawachi-ibaraki] fetchPage 失敗: ${url} status=${res.status}`
      );
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(
      `[084476-kawachi-ibaraki] fetchPage 失敗: ${url}`,
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
    if (!res.ok) {
      console.warn(
        `[084476-kawachi-ibaraki] fetchBinary 失敗: ${url} status=${res.status}`
      );
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[084476-kawachi-ibaraki] fetchBinary 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * 和暦の年から西暦を返す。
 * 例: "令和6年" → 2024, "令和元年" → 2019, "平成30年" → 2018
 */
export function parseWarekiYear(text: string): number | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const reiwa = normalized.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = normalized.match(/平成(元|\d+)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/**
 * 和暦の年月日を YYYY-MM-DD に変換する。
 * 例: "令和6年12月5日" → "2024-12-05"
 *     "令和元年5月1日" → "2019-05-01"
 *     "平成24年6月15日" → "2012-06-15"
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

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
