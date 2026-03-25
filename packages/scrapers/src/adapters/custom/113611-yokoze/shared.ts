/**
 * 横瀬町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.yokoze.saitama.jp/yokoze/about-yokoze/5696
 * 分類: WordPress ベースの静的 HTML 公開
 * 文字コード: UTF-8
 * 会議録形式: PDF
 */

export const BASE_ORIGIN = "https://www.town.yokoze.saitama.jp";

/** 会議録メインページ（R2〜R7） */
export const MAIN_LIST_URL = `${BASE_ORIGIN}/yokoze/about-yokoze/5696`;

/** 旧資料室ページ（H27〜R1） */
export const ARCHIVE_LIST_URL = `${BASE_ORIGIN}/yokoze/shiryo/120`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(
  title: string,
): "plenary" | "committee" | "extraordinary" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
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

/** fetch して ArrayBuffer を返す（PDF 用） */
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
 * 相対 URL を絶対 URL に変換する。
 */
export function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return `${BASE_ORIGIN}/${href}`;
}

/**
 * 全角数字を半角に変換する。
 */
export function normalizeNumbers(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦テキストから西暦年を変換する。
 * 元年 = 1 として処理。
 *
 * e.g., "令和6" -> 2024
 *       "令和元" -> 2019
 *       "平成30" -> 2018
 */
export function eraToWestern(era: string, eraYearStr: string): number {
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  if (era === "昭和") return eraYear + 1925;
  return eraYear;
}

/**
 * タイトル文字列から年を抽出する（西暦）。
 * e.g., "令和6年第2回定例会議事録" → 2024
 * e.g., "令和元年第3回定例会" → 2019
 * e.g., "H30.3kaigiroku" → 2018
 *
 * null の場合は年を特定できない。
 */
export function extractYearFromTitle(title: string): number | null {
  // 全角数字を半角に変換
  const normalized = normalizeNumbers(title);

  // 和暦パターン: 令和X年 or 平成X年
  const japaneseMatch = normalized.match(/(令和|平成)(元|\d+)年/);
  if (japaneseMatch) {
    return eraToWestern(japaneseMatch[1]!, japaneseMatch[2]!);
  }

  return null;
}

/**
 * テーブルの列ヘッダーテキストから西暦年を抽出する。
 * e.g., "令和6年" -> 2024
 *       "令和元年（R1/2019年）" -> 2019
 *       "平成27年" -> 2015
 */
export function parseYearFromHeader(header: string): number | null {
  const normalized = normalizeNumbers(header.trim());

  // 令和・平成パターン
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (match) {
    return eraToWestern(match[1]!, match[2]!);
  }

  return null;
}

/**
 * セルテキストから開催月と会議種別を抽出する。
 * e.g., "3月定例会" -> { month: 3, sessionType: "定例会" }
 * e.g., "11月臨時会" -> { month: 11, sessionType: "臨時会" }
 */
export function parseSessionFromCell(
  text: string,
): { month: number; sessionType: string } | null {
  const normalized = normalizeNumbers(text.trim());
  const match = normalized.match(/(\d+)月(定例会|臨時会)/);
  if (!match) return null;

  return {
    month: parseInt(match[1]!, 10),
    sessionType: match[2]!,
  };
}
