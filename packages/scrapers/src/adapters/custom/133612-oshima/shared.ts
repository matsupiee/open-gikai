/**
 * 大島町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.oshima.tokyo.jp/soshiki/gikaijim/gikai-kekka.html
 * 議案等の審議・決定結果報告を PDF で公開。
 * PDF はスキャン画像のためテキストレイヤーなし。
 */

export const BASE_URL =
  "https://www.town.oshima.tokyo.jp/soshiki/gikaijim/gikai-kekka.html";

export const BASE_ORIGIN = "https://www.town.oshima.tokyo.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
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
      e instanceof Error ? e.message : e
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
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和7年" → 2025, "平成26年" → 2014, "令和元年" → 2019
 */
export function parseEraYear(text: string): number | null {
  const match = text.match(/(?:令和|平成)(元|\d+)年/);
  if (!match) return null;

  const eraYearStr = match[1]!;
  const eraYear = eraYearStr === "元" ? 1 : Number(eraYearStr);

  if (text.includes("令和")) return eraYear + 2018;
  if (text.includes("平成")) return eraYear + 1988;
  return null;
}
