/**
 * 四万十町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.shimanto.lg.jp/gijiroku/
 * 自治体コード: 394122
 *
 * 独自 PHP による会議録検索システム。
 * 年度切り替えはフォーム POST による動的表示。
 * 文字コード: UTF-8
 */

export const BASE_ORIGIN = "https://www.town.shimanto.lg.jp";

/** 会議録カテゴリ一覧 URL */
export const LIST_BASE_URL = `${BASE_ORIGIN}/gijiroku/`;

/** 会議録カテゴリ: 130 */
export const KATUGI_GIJIROKU = "130";

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
    if (!res.ok) {
      console.warn(`[394122-shimanto] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[394122-shimanto] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** POST でフォームを送信してテキストを返す */
export async function fetchPost(url: string, params: Record<string, string>): Promise<string | null> {
  try {
    const body = new URLSearchParams(params);
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[394122-shimanto] fetchPost failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[394122-shimanto] fetchPost error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（バイナリ用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[394122-shimanto] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[394122-shimanto] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6年" → 2024, "平成30年" → 2018, "令和元年" → 2019
 * 変換できない場合は null を返す。
 */
export function eraToWesternYear(era: string, yearInEra: number): number | null {
  if (era === "令和") return yearInEra + 2018;
  if (era === "平成") return yearInEra + 1988;
  if (era === "昭和") return yearInEra + 1925;
  return null;
}

/**
 * 開催日文字列（YYYY/MM/DD）から YYYY-MM-DD を返す。
 * 変換できない場合は null を返す（フォールバック禁止）。
 */
export function parseSlashDate(text: string): string | null {
  const m = text.match(/(\d{4})\/(\d{2})\/(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * 日本語の日付文字列から YYYY-MM-DD を抽出する。
 * 例: "令和6年2月8日" → "2024-02-08"
 * 変換できない場合は null を返す（フォールバック禁止）。
 */
export function parseJapaneseDate(text: string): string | null {
  const m = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!m) return null;
  const yearInEra = m[2] === "元" ? 1 : parseInt(m[2]!, 10);
  const westernYear = eraToWesternYear(m[1]!, yearInEra);
  if (westernYear === null) return null;
  const month = parseInt(m[3]!, 10);
  const day = parseInt(m[4]!, 10);
  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}
