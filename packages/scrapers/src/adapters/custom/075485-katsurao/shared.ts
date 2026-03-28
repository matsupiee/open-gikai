/**
 * 葛尾村議会 -- 共通ユーティリティ
 *
 * サイト: https://www.katsurao.org/site/gikai/
 * 自治体コード: 075485
 */

export const BASE_ORIGIN = "https://www.katsurao.org";
export const DEFAULT_BASE_URL = `${BASE_ORIGIN}/site/gikai/`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** 全角数字を半角に変換する */
export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦年を西暦に変換する。
 * 例: "令和6年" → 2024, "令和元年" → 2019
 */
export function parseWarekiYear(text: string): number | null {
  const normalized = toHalfWidth(text);

  const reiwa = normalized.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const year = reiwa[1] === "元" ? 1 : Number.parseInt(reiwa[1], 10);
    return 2018 + year;
  }

  const heisei = normalized.match(/平成(元|\d+)年/);
  if (heisei?.[1]) {
    const year = heisei[1] === "元" ? 1 : Number.parseInt(heisei[1], 10);
    return 1988 + year;
  }

  return null;
}

/** HTML を取得して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`fetchPage failed: ${url} status=${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.warn(
      `fetchPage error: ${url}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
