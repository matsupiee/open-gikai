/**
 * 岐阜県大野町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town-ono.jp/category/2-0-0-0-0-0-0-0-0-0.html
 * 一般質問は「議会だより（一般質問）」ページの PDF として年度別に公開されている。
 */

export const BASE_ORIGIN = "https://www.town-ono.jp";

/** 議会トップページ URL */
export const TOP_PAGE_URL =
  "https://www.town-ono.jp/category/2-0-0-0-0-0-0-0-0-0.html";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
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
    const res = await fetch(url, { signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS) });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 和暦日付テキストから YYYY-MM-DD を返す。
 * e.g., "令和7年3月5日" → "2025-03-05"
 * e.g., "令和元年9月12日" → "2019-09-12"
 */
export function parseDateText(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 会議タイトルから meetingType を返す。
 * 臨時会 → "extraordinary"
 * 定例会 → "plenary"
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 相対パスを絶対 URL に変換する。
 * e.g., "./cmsfiles/contents/0000002/2234/r06ippansitumon1.pdf"
 *      + "https://www.town-ono.jp/0000002234.html"
 *   → "https://www.town-ono.jp/cmsfiles/contents/0000002/2234/r06ippansitumon1.pdf"
 */
export function resolveUrl(href: string, pageUrl: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;

  // ./ 相対パスの場合: ページの親ディレクトリを基準に解決
  const base = pageUrl.replace(/\/[^/]*$/, "/");
  const cleaned = href.replace(/^\.\//, "");
  return `${base}${cleaned}`;
}
