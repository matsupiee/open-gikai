/**
 * 吉岡町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.yoshioka.lg.jp/gikai/kaigiroku/
 *
 * 吉岡町は全ての会議録を PDF で公開。HTML ページに会議名・会期・PDF URL が掲載される。
 */

export const BASE_ORIGIN = "https://www.town.yoshioka.lg.jp";

/** 会議録トップページ（最新年） */
export const TOP_LIST_URL = `${BASE_ORIGIN}/gikai/kaigiroku/`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): "plenary" | "committee" | "extraordinary" {
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
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
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
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 相対 URL または絶対 URL を BASE_ORIGIN を基準に絶対 URL へ変換する。
 */
export function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return `${BASE_ORIGIN}/gikai/kaigiroku/${href}`;
}

/**
 * 西暦年から年別ページ URL を組み立てる。
 * 最新年はトップページ、過去年は bn_{year}.html。
 * 最新年（2025年）はトップページに直接掲載される。
 */
export function buildYearPageUrl(year: number, latestYear: number): string {
  if (year === latestYear) return TOP_LIST_URL;
  return `${BASE_ORIGIN}/gikai/kaigiroku/bn_${year}.html`;
}

/**
 * 和暦の日付文字列から YYYY-MM-DD を抽出する。
 * e.g., "2024年12月02日(月曜日)〜12月12日(木曜日)" → "2024-12-02"
 * e.g., "令和6年第4回定例会" は対象外 → 西暦の日付を使う
 * 西暦 \d{4}年\d{2}月\d{2}日 パターンと和暦パターン両方に対応。
 */
export function parseDateFromText(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  // 西暦パターン: 2024年12月02日 or 2024年12月2日
  const westernMatch = normalized.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (westernMatch) {
    const year = parseInt(westernMatch[1]!, 10);
    const month = parseInt(westernMatch[2]!, 10);
    const day = parseInt(westernMatch[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 和暦パターン
  const japaneseMatch = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!japaneseMatch) return null;

  const era = japaneseMatch[1]!;
  const eraYear = japaneseMatch[2] === "元" ? 1 : parseInt(japaneseMatch[2]!, 10);
  const month = parseInt(japaneseMatch[3]!, 10);
  const day = parseInt(japaneseMatch[4]!, 10);

  const westernYear = eraYear + (era === "平成" ? 1988 : 2018);
  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * タイトルから西暦年を抽出する。
 * e.g., "令和6年第4回定例会" → 2024
 * e.g., "令和元年第1回定例会" → 2019
 * e.g., "平成21年第4回定例会" → 2009
 */
export function extractYearFromTitle(title: string): number | null {
  // 全角数字を半角に変換
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);

  return eraYear + (era === "平成" ? 1988 : 2018);
}
