/**
 * 本巣市議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.city.motosu.lg.jp/category/6-3-0-0-0-0-0-0-0-0.html
 * 自治体コード: 212181
 *
 * PDF 形式で会議録を公開。年度 ID をもとにカテゴリページへアクセスし、
 * 会議録詳細ページへのリンクを収集する。詳細ページから PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.city.motosu.lg.jp";

/**
 * 西暦年 → 年度 ID のマッピング。
 * motosu サイトの年度 ID 対応表に基づく。
 */
export const YEAR_ID_MAP: Record<number, number> = {
  2026: 23, // 令和8年
  2025: 22, // 令和7年
  2024: 21, // 令和6年
  2023: 20, // 令和5年
  2022: 19, // 令和4年
  2021: 18, // 令和3年
  2020: 17, // 令和2年
  2019: 1, // 平成31年・令和元年
  2018: 2, // 平成30年
  2017: 3, // 平成29年
  2016: 4, // 平成28年
  2015: 5, // 平成27年
  2014: 6, // 平成26年
  2013: 7, // 平成25年
  2012: 8, // 平成24年
  2011: 9, // 平成23年
  2010: 10, // 平成22年
  2009: 11, // 平成21年
  2008: 12, // 平成20年
  2007: 13, // 平成19年
  2006: 14, // 平成18年
  2005: 15, // 平成17年
  2004: 16, // 平成16年
};

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 会議タイプを検出する。
 * - 臨時会 → extraordinary
 * - 委員会 / 審査会 → committee
 * - それ以外（本会議・定例会） → plenary
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会") || title.includes("審査会"))
    return "committee";
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
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す */
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
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 全角数字を半角に変換する。
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/**
 * テキストから開催日（YYYY-MM-DD）を抽出する。
 * パターン: 「令和X年X月X日」or 「平成X年X月X日」（全角数字対応、元年対応）
 */
export function extractDateFromText(text: string): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  const baseYear = era === "令和" ? 2018 : 1988;
  const westernYear = baseYear + eraYear;
  const month = Number(match[3]);
  const day = Number(match[4]);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * PDF テキストから開催日（YYYY-MM-DD）を抽出する。
 */
export function extractHeldOnFromText(text: string): string | null {
  return extractDateFromText(text);
}
