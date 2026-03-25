/**
 * 小値賀町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.town.ojika.lg.jp/soshiki/gikaijimukyoku/1/1/3/2/238.html
 * 自治体コード: 423831
 */

export const BASE_ORIGIN = "https://www.town.ojika.lg.jp";

/** 会議録一覧ページ URL */
export const LIST_URL = `${BASE_ORIGIN}/soshiki/gikaijimukyoku/1/1/3/2/238.html`;

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
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す */
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
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 全角数字を半角に変換する。
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 会議タイトルから会議種別を判定する。
 * - 臨時 → extraordinary
 * - 定例 → plenary
 * - 委員会 → committee
 * - それ以外 → plenary
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/**
 * プロトコル相対 URL を絶対 URL に変換する。
 * "//www.town.ojika.lg.jp/..." → "https://www.town.ojika.lg.jp/..."
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return href;
}

/**
 * 和暦年テキストから西暦年に変換する。
 * 「令和6年」→ 2024, 「令和元年」→ 2019
 * 全角数字にも対応する。
 */
export function convertWarekiToWesternYear(text: string): number | null {
  const normalized = toHalfWidth(text);

  const reiwaMatch = normalized.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : Number(reiwaMatch[1]);
    return 2018 + eraYear;
  }

  const heiseiMatch = normalized.match(/平成(元|\d+)年/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : Number(heiseiMatch[1]);
    return 1988 + eraYear;
  }

  return null;
}
