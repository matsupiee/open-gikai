/**
 * 南陽市議会 会議録 — 共通ユーティリティ
 *
 * サイト: http://www.city.nanyo.yamagata.jp/gikaikaigiroku/
 *
 * 南陽市は PDF ベースで議事録を公開している。
 * トップページ（/gikaikaigiroku/）から年度別ページへのリンクを取得し、
 * 各年度ページから PDF リンクを収集する。
 */

export const BASE_URL = "http://www.city.nanyo.yamagata.jp";
export const INDEX_PATH = "/gikaikaigiroku/";
export const PDF_BASE_PATH =
  "/up/files/giyousei/sigikai/gikaikaigiroku/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const BINARY_TIMEOUT_MS = 120_000;

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
      `[062138-nanyo] ページ取得失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF 用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(BINARY_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[062138-nanyo] バイナリ取得失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** 会議タイトルから meetingType を判定する */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * リンクテキストや PDF ファイル名から会議の開催年を抽出する。
 * e.g., "令和６年会議録" → 2024
 *       "平成21年会議録" → 2009
 */
export function parseEraYear(text: string): number | null {
  const match = text.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYearStr = match[2]!;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);

  if (era === "令和") {
    return eraYear + 2018;
  }
  if (era === "平成") {
    return eraYear + 1988;
  }
  return null;
}
