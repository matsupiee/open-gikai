/**
 * 大館市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.odate.lg.jp/city/handbook/handbook13/page56/kaigiroku
 * 自治体コード: 052043
 */

export const BASE_ORIGIN = "https://www.city.odate.lg.jp";

/** 会議録トップページ URL */
export const TOP_URL = `${BASE_ORIGIN}/city/handbook/handbook13/page56/kaigiroku`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[odate] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリを返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[odate] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦テキストから西暦年を返す。
 * 例: "令和6年" → 2024, "平成29年" → 2017, "平成31年" → 2019, "令和元年" → 2019
 */
export function parseWarekiYear(text: string): number | null {
  const reiwa = text.match(/令和(\d+|元)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = text.match(/平成(\d+|元)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/**
 * 全角数字を半角数字に変換する。
 * 例: "２月２６日" → "2月26日"
 */
export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30)
  );
}

/**
 * URL を絶対 URL に変換する。
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return href;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
