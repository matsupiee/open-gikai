/**
 * 蘭越町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.rankoshi.hokkaido.jp/administration/town/detail.html?content=301
 * 自治体コード: 013943
 *
 * 会議録は全て PDF 形式で提供される。
 * 一覧ページ (content=301) から年度別ページへのリンクを収集し、
 * 各年度ページから PDF リンクを取得する 2 段階クロール。
 */

export const BASE_ORIGIN = "https://www.town.rankoshi.hokkaido.jp";
export const LIST_PAGE_URL = `${BASE_ORIGIN}/administration/town/detail.html?content=301`;

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
      console.warn(`[013943-rankoshi] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`[013943-rankoshi] fetchPage error: ${url}`, e instanceof Error ? e.message : e);
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
      console.warn(`[013943-rankoshi] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[013943-rankoshi] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 全角数字を半角数字に変換する。
 */
export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30));
}

/**
 * 和暦テキストから西暦年を返す。
 * 例: "令和6年" → 2024, "令和８年" → 2026, "令和元年" → 2019, "平成31年" → 2019
 * 全角数字・半角数字の両方に対応する。
 */
export function eraToWesternYear(eraText: string): number | null {
  // 全角数字を半角に変換してからマッチ
  const normalized = toHalfWidth(eraText);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, yearPart] = match;
  const eraYear = yearPart === "元" ? 1 : parseInt(yearPart!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 会議種別を検出する。
 */
export function detectMeetingType(title: string): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
