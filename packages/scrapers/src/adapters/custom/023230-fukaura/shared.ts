/**
 * 深浦町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.fukaura.lg.jp/category/bunya/gikai/
 * Joruri CMS ベース。定例会・臨時会の一覧ページと個別記事ページから
 * 一般質問 PDF を取得し、議会だより形式の Q&A テキストを解析する。
 */

export const BASE_ORIGIN = "https://www.town.fukaura.lg.jp";

/**
 * 定例会・臨時会の全件インデックスページ。
 * h2 で年度別に見出しが分かれ、各定例会・臨時会へのリンクが並ぶ。
 */
export const INDEX_URL =
  "https://www.town.fukaura.lg.jp/doc/2024090200018/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
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
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * 西暦年を和暦年（令和N）に変換する。
 * e.g., 2025 → 7, 2026 → 8
 */
export function toReiwaYear(year: number): number {
  return year - 2018;
}

/**
 * 年度の範囲を返す。
 * 日本の会計年度は 4月〜翌年3月。
 * e.g., year=2025 → { start: 2025-04-01, end: 2026-03-31 }
 */
export function fiscalYearRange(year: number): {
  startYear: number;
  startMonth: number;
  endYear: number;
  endMonth: number;
} {
  return {
    startYear: year,
    startMonth: 4,
    endYear: year + 1,
    endMonth: 3,
  };
}

/**
 * 記事 URL からドキュメント ID を抽出する。
 * e.g., "/doc/2026031800110/" → "2026031800110"
 */
export function extractDocId(url: string): string | null {
  const match = url.match(/\/doc\/(\d+)\/?/);
  return match ? match[1]! : null;
}
