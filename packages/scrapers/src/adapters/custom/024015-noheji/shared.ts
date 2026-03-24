/**
 * 野辺地町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.noheji.aomori.jp/life/chosei/gikai/2787
 */

export const BASE_ORIGIN = "https://www.town.noheji.aomori.jp";
export const LIST_URL = `${BASE_ORIGIN}/life/chosei/gikai/2787`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[noheji] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`[noheji] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリ (ArrayBuffer) を返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
      redirect: "follow",
    });
    if (!res.ok) {
      console.warn(`[noheji] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[noheji] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/**
 * 会議タイトルから会議種別を検出する。
 */
export function detectMeetingType(title: string): "plenary" | "extraordinary" {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 全角数字を半角に変換する。
 */
export function normalizeFullWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30))
    .replace(/[　]/g, " ");
}

/**
 * 和暦テキストを YYYY-MM-DD に変換する。
 * 対応: 令和（元年含む）・平成
 * 解析できない場合は null を返す。
 */
export function parseJapaneseDate(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = normalizeFullWidth(text);

  // 令和（元年対応）
  const reiwaMatch = normalized.match(/令和(元|\d+)年(\d+)月[\s　]*(\d+)日/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    const year = 2018 + eraYear;
    const month = parseInt(reiwaMatch[2]!, 10);
    const day = parseInt(reiwaMatch[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 平成（元年対応）
  const heiseiMatch = normalized.match(/平成(元|\d+)年(\d+)月[\s　]*(\d+)日/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : parseInt(heiseiMatch[1]!, 10);
    const year = 1988 + eraYear;
    const month = parseInt(heiseiMatch[2]!, 10);
    const day = parseInt(heiseiMatch[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}
