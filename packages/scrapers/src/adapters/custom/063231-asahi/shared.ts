/**
 * 朝日町教育委員会 定例会会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.asahi.yamagata.jp/
 *
 * 朝日町教育委員会は PDF ベースで定例会会議録を公開している。
 * 1ページに年度内の全会議録 PDF リンクが掲載される単純な構造。
 */

export const BASE_ORIGIN = "https://www.town.asahi.yamagata.jp";
export const INDEX_PATH =
  "/portal/soshikinogoannai/kyoikubunkaka/gakkokyoikukakari/1_1/1/9645.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出（教育委員会は全て committee） */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  return "committee";
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
 * 西暦年度を和暦プレフィックスに変換する。
 * 年度（4月始まり）なので year は年度の開始年。
 * e.g., 2024 → "R6" (令和6年度)
 */
export function toEraPrefix(fiscalYear: number): string | null {
  if (fiscalYear >= 2019) {
    const eraYear = fiscalYear - 2018;
    return `R${eraYear}`;
  }
  if (fiscalYear >= 1989) {
    const eraYear = fiscalYear - 1988;
    return `H${eraYear}`;
  }
  return null;
}

/**
 * PDF ファイル名から externalId 用のキーを抽出する。
 * e.g., "R6_4.pdf" → "R6_4"
 *       "R6_7shusei.pdf" → "R6_7shusei"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/([^/]+)\.pdf$/i);
  if (!match?.[1]) return null;
  return match[1];
}
