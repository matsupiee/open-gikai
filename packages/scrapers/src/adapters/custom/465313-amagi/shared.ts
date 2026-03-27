/**
 * 天城町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.amagi.lg.jp/docs/410.html
 * 自治体コード: 465313
 *
 * 単一ページに年度別の PDF 一覧が掲載されている。
 */

export const BASE_URL = "https://www.town.amagi.lg.jp/docs/410.html";
export const BASE_ORIGIN = "https://www.town.amagi.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

/** 会議タイプを検出する */
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
      console.warn(`[465313-amagi] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[465313-amagi] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
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
      console.warn(`[465313-amagi] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[465313-amagi] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 年度見出しから西暦年を返す。
 * 例: "令和6年 議事録" → 2024, "令和元年 議事録" → 2019
 */
export function parseEraYear(text: string): number | null {
  const normalized = normalizeDigits(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  if (match[1] === "令和") return eraYear + 2018;
  if (match[1] === "平成") return eraYear + 1988;
  return null;
}

/**
 * テキストから月日を抽出する。
 * 例: "R6天城町4定(1号)12月5日" → { month: 12, day: 5 }
 */
export function parseMonthDay(text: string): { month: number; day: number } | null {
  const normalized = normalizeDigits(text);
  const match = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  return {
    month: Number(match[1]),
    day: Number(match[2]),
  };
}
