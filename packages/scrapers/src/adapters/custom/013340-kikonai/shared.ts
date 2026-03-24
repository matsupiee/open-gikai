/**
 * 木古内町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.town.kikonai.hokkaido.jp/gikai/kaigiroku/
 * UTF-8 エンコードの自治体公式サイト。PDF 形式で年度別に会議録を公開。
 */

export const BASE_ORIGIN = "https://www.town.kikonai.hokkaido.jp";

/** 会議録トップページ URL */
export const TOP_PAGE_URL = `${BASE_ORIGIN}/gikai/kaigiroku/`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** 全角数字を半角数字に変換する */
export function normalizeNumbers(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 年号コードから西暦年を返す。
 * e.g., "R6" -> 2024, "R7" -> 2025, "H31" -> 2019, "H30" -> 2018
 */
export function eraCodeToYear(code: string): number | null {
  const rMatch = code.match(/^R(\d+)$/);
  if (rMatch) {
    return parseInt(rMatch[1]!, 10) + 2018;
  }
  const hMatch = code.match(/^H(\d+)$/);
  if (hMatch) {
    const hYear = parseInt(hMatch[1]!, 10);
    // H31 は令和元年（2019年）として扱う
    return hYear + 1988;
  }
  return null;
}

/**
 * 和暦テキスト（例: "令和6年3月4日"）を "YYYY-MM-DD" に変換する。
 * 期間表記（"令和6年3月4日～3月11日"）の場合は開始日を返す。
 * 解析できない場合は null を返す。
 */
export function parseHeldOn(text: string): string | null {
  const normalized = normalizeNumbers(text.trim());

  // 令和・平成の和暦パターン
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, yearStr, monthStr, dayStr] = match;
  const eraYear = yearStr === "元" ? 1 : parseInt(yearStr!, 10);

  let year: number;
  if (era === "令和") {
    year = eraYear + 2018;
  } else if (era === "平成") {
    year = eraYear + 1988;
  } else {
    return null;
  }

  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
      signal: AbortSignal.timeout(60_000),
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
