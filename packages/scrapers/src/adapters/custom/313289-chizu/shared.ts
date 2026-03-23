/**
 * 智頭町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www1.town.chizu.tottori.jp/chizu/gikaijimukyoku/gijiroku/
 * 自治体コード: 313289
 *
 * 智頭町は PDF ベースで議事録を公開している。
 * 会議録トップページから年度別ページへのリンクを取得し、
 * 各年度ページから PDF リンクを直接収集する。
 * 平成24〜25年はトップページに直接 PDF リンクが掲載されている。
 */

export const BASE_ORIGIN = "https://www1.town.chizu.tottori.jp";
export const INDEX_PATH = "/chizu/gikaijimukyoku/gijiroku/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
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
  } catch (err) {
    console.warn(
      `[313289-chizu] fetchPage 失敗: ${url}`,
      err instanceof Error ? err.message : err,
    );
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
  } catch (err) {
    console.warn(
      `[313289-chizu] fetchBinary 失敗: ${url}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * アンカーテキストから開催日 (YYYY-MM-DD) を抽出する。
 *
 * パターン: "初　日（R6.12.05）" "２日目（R6.12.06）" "１日限り（R6.06.14）"
 * 和暦略号: R = 令和, H = 平成
 */
export function extractDateFromLabel(label: string): string | null {
  const match = label.match(/[（(]([RH])(\d+)\.(\d+)\.(\d+)[)）]/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  const calendarYear = era === "R" ? 2018 + eraYear : 1988 + eraYear;

  return `${calendarYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 西暦年を和暦（令和/平成）に変換する。
 */
export function toWareki(
  year: number,
): { era: string; eraYear: number } | null {
  if (year >= 2019) {
    return { era: "令和", eraYear: year - 2018 };
  }
  if (year >= 1989) {
    return { era: "平成", eraYear: year - 1988 };
  }
  return null;
}
