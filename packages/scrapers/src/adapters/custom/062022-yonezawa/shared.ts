/**
 * 米沢市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.yonezawa.yamagata.jp/
 *
 * 米沢市は PDF ベースで議事録を公開している。
 * 一覧ページ（260.html）から定例会セッションページへのリンクと、
 * 臨時会 PDF への直接リンクを取得する。
 */

export const BASE_ORIGIN = "https://www.city.yonezawa.yamagata.jp";
export const INDEX_PATH = "/soshiki/12/1037/5/1/260.html";

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

/** fetch して ArrayBuffer を返す（PDF 用） */
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
 * 西暦年を和暦（令和/平成）に変換する。
 * e.g., 2025 → { era: "令和", eraYear: 7, prefix: "r07" }
 */
export function toEraInfo(year: number): {
  era: string;
  eraYear: number;
  prefix: string;
} | null {
  if (year >= 2019) {
    const eraYear = year - 2018;
    return {
      era: "令和",
      eraYear,
      prefix: `r${String(eraYear).padStart(2, "0")}`,
    };
  }
  if (year >= 1989) {
    const eraYear = year - 1988;
    return {
      era: "平成",
      eraYear,
      prefix: `h${String(eraYear).padStart(2, "0")}`,
    };
  }
  return null;
}

/**
 * PDF ファイル名から externalId 用のキーを抽出する。
 * e.g., "r06-12t-01-1205.pdf" → "r06-12t-01-1205"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/([^/]+)\.pdf$/i);
  if (!match?.[1]) return null;
  return match[1];
}
