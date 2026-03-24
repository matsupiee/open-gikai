/**
 * 西予市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/index.html
 * 自治体コード: 382141
 *
 * 全会議録は PDF ファイルで提供される。
 * 本会議・常任委員会・特別委員会・全員協議会の4カテゴリを対象とする。
 */

export const BASE_URL = "https://www.city.seiyo.ehime.jp";

/**
 * 各カテゴリのインデックスページURL（ハードコード）
 */
export const INDEX_URLS = {
  honkaigi: `${BASE_URL}/shisei/shigikai/kaigiroku/honkaigi/index.html`,
  joniniinkai: `${BASE_URL}/shisei/shigikai/kaigiroku/iinkai/joniniinkai/index.html`,
  tokubetsuiinkai: `${BASE_URL}/shisei/shigikai/kaigiroku/iinkai/tokubetsuiinkai/index.html`,
  zeninkyougikai: `${BASE_URL}/shisei/shigikai/kaigiroku/iinkai/zeninkyougikai/index.html`,
} as const;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[382141-seiyo] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`[382141-seiyo] fetchPage error: ${url}`, e instanceof Error ? e.message : e);
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
      console.warn(`[382141-seiyo] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[382141-seiyo] fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和6年" → 2024, "令和元年" → 2019, "平成30年" → 2018
 */
export function eraToWesternYear(eraText: string): number | null {
  const match = eraText.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, yearPart] = match;
  const eraYear = yearPart === "元" ? 1 : parseInt(yearPart!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 会議種別を検出する。
 */
export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("全員協議会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
