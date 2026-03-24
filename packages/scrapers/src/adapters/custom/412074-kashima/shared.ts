/**
 * 鹿島市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.saga-kashima.lg.jp/main/107.html
 * 自治体コード: 412074
 */

export const BASE_ORIGIN = "https://www.city.saga-kashima.lg.jp";

/** トップページ（会議録一覧） */
export const TOP_PAGE_PATH = "/main/107.html";

/** 過去ログ一覧ページ */
export const PAST_LOG_PAGE_PATH = "/main/32950.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議種別を検出 */
export function detectMeetingType(title: string): "plenary" | "extraordinary" | "committee" {
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
      console.warn(`[kashima] fetchPage: HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[kashima] fetchPage: failed to fetch ${url}:`, err);
    return null;
  }
}

/** fetch してバイナリを返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[kashima] fetchBinary: HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(`[kashima] fetchBinary: failed to fetch ${url}:`, err);
    return null;
  }
}

/**
 * 和暦日付文字列から西暦 YYYY-MM-DD を返す。
 *
 * 対応パターン:
 *   - "20241129" (YYYYMMDD 形式: 令和6年12月定例会)
 *   - "R06.9.3" (Rnn.M.D 形式)
 *   - "R6.9.3" (Rn.M.D 形式、表記ゆれ)
 *
 * 解析できない場合は null を返す（フォールバック値禁止）。
 */
export function parseHeldOn(dateStr: string): string | null {
  // YYYYMMDD 形式（例: "20241129"）
  const yyyymmdd = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (yyyymmdd) {
    const year = yyyymmdd[1]!;
    const month = yyyymmdd[2]!;
    const day = yyyymmdd[3]!;
    return `${year}-${month}-${day}`;
  }

  // Rnn.M.D 形式（例: "R06.9.3", "R7.12.4"）
  const reiwa = dateStr.match(/^R(\d+)\.(\d{1,2})\.(\d{1,2})$/);
  if (reiwa) {
    const rn = parseInt(reiwa[1]!, 10);
    const month = parseInt(reiwa[2]!, 10);
    const day = parseInt(reiwa[3]!, 10);
    const year = 2018 + rn;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}
