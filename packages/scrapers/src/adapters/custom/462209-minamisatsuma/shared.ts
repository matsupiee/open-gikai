/**
 * 南さつま市議会 — 共通ユーティリティ
 *
 * サイト: https://smart.discussvision.net/smart/tenant/minamisatsuma/WebView/rd/council_1.html
 * 自治体コード: 462209
 *
 * DiscussVision 社 smart.discussvision.net による映像配信システム。
 * テナント ID: 320
 * JSONP ベースの API でデータを取得する。
 * 全期間にわたってテキスト会議録は提供されていない（映像配信専用）。
 */

export const BASE_ORIGIN = "https://smart.discussvision.net";
export const TENANT_ID = 320;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * JSONP レスポンスからデータを取り出す。
 * DiscussVision API は `callback([...])` または `callback({...})` 形式で返す。
 * callback パラメータを固定値 `__cb` として渡し、レスポンスからデータを抽出する。
 */
export function parseJsonp(text: string): unknown {
  // __cb([...]) や __cb({...}) 形式にマッチ
  const m = text.match(/^__cb\(([\s\S]*)\)\s*;?\s*$/);
  if (!m) {
    throw new Error(`JSONP レスポンスのパースに失敗: ${text.slice(0, 100)}`);
  }
  return JSON.parse(m[1]!);
}

/** JSONP API を fetch してパース済みデータを返す */
export async function fetchJsonp(url: string): Promise<unknown> {
  const urlWithCb = `${url}${url.includes("?") ? "&" : "?"}callback=__cb`;
  try {
    const res = await fetch(urlWithCb, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[462209-minamisatsuma] fetchJsonp failed: ${urlWithCb} status=${res.status}`);
      return null;
    }
    const text = await res.text();
    return parseJsonp(text);
  } catch (e) {
    console.warn(
      `[462209-minamisatsuma] fetchJsonp error: ${urlWithCb}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** fetch してテキストを返す（HTML ページ用） */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[462209-minamisatsuma] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[462209-minamisatsuma] fetchPage error: ${url}`,
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
      console.warn(`[462209-minamisatsuma] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[462209-minamisatsuma] fetchBinary error: ${url}`,
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
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}
