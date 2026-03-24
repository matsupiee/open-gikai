/**
 * 知内町議会（北海道） — 共通ユーティリティ
 *
 * サイト: https://www.town.shiriuchi.hokkaido.jp/chosei/gikai/kaigiroku/
 * 自治体コード: 013331
 */

export const BASE_ORIGIN = "https://www.town.shiriuchi.hokkaido.jp";

/** 会議録トップページ（年度一覧） */
export const TOP_PAGE_URL = `${BASE_ORIGIN}/chosei/gikai/kaigiroku/`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 年号コード（h24, h25, ..., r01, r02, ...）から西暦年を返す。
 *
 * 例: "h24" → 2012, "h31" → 2019, "r01" → 2019, "r07" → 2025
 */
export function eraCodeToYear(code: string): number | null {
  const lower = code.toLowerCase();

  const hMatch = lower.match(/^h(\d+)$/);
  if (hMatch) {
    const n = parseInt(hMatch[1]!, 10);
    return 1988 + n;
  }

  const rMatch = lower.match(/^r(\d+)$/);
  if (rMatch) {
    const n = parseInt(rMatch[1]!, 10);
    return 2018 + n;
  }

  return null;
}

/**
 * 和暦の年月日テキスト（例: "令和6年3月4日"）から YYYY-MM-DD 文字列を返す。
 * 解析できない場合は null を返す。
 */
export function parseHeldOn(text: string): string | null {
  const m = text.match(
    /(令和|平成)(元|\d+)年\s*(\d{1,2})月\s*(\d{1,2})日/,
  );
  if (!m) return null;

  const era = m[1]!;
  const yearPart = m[2]!;
  const month = parseInt(m[3]!, 10);
  const day = parseInt(m[4]!, 10);

  const n = yearPart === "元" ? 1 : parseInt(yearPart, 10);
  const westernYear = era === "令和" ? 2018 + n : 1988 + n;

  if (!westernYear || !month || !day) return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 会議種別を判定する。
 */
export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("特別委員会")) return "committee";
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
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[013331-shiriuchi] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[013331-shiriuchi] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
