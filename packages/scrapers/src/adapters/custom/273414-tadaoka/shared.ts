/**
 * 忠岡町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.tadaoka.osaka.jp/gyousei/gikai/2110.html
 * PDF ベースの議事録公開。一覧ページから詳細ページ経由で PDF をダウンロードする方式。
 */

export const BASE_ORIGIN = "https://www.town.tadaoka.osaka.jp";

/** 会議録一覧ページの URL */
export const LIST_URL = `${BASE_ORIGIN}/gyousei/gikai/2110.html`;

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
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
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
 * 会議タイトルから会議タイプを検出する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦テキストから西暦年を変換する。
 * e.g., "令和6" → 2024, "平成27" → 2015
 */
export function parseJapaneseYear(
  era: string,
  eraYear: number
): number | null {
  if (era === "令和") {
    return 2018 + eraYear;
  } else if (era === "平成") {
    return 1988 + eraYear;
  }
  return null;
}

/**
 * 和暦日付テキストから YYYY-MM-DD を抽出する。
 * e.g., "令和6年12月24日" → "2024-12-24"
 * e.g., "平成27年3月5日" → "2015-03-05"
 */
export function parseJapaneseDate(text: string): string | null {
  const match = text.match(/(令和|平成)(\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = Number(match[2]);
  const month = Number(match[3]);
  const day = Number(match[4]);

  const year = parseJapaneseYear(era, eraYear);
  if (!year) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * href を絶対 URL に正規化する。
 * プロトコル相対 URL（//www.town.tadaoka.osaka.jp/...）にも対応する。
 */
export function normalizeUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
}
