/**
 * 栗山町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.kuriyama.hokkaido.jp/site/gikai/7389.html
 * 自治体コード: 014290
 *
 * 文字コード:
 *   - 一覧ページ: UTF-8
 *   - 会議録 HTML: Shift_JIS
 */

export const BASE_ORIGIN = "https://www.town.kuriyama.hokkaido.jp";

/** 会議録一覧ページ URL */
export const LIST_PAGE_URL = `${BASE_ORIGIN}/site/gikai/7389.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
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
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** fetch して Shift_JIS テキストを返す */
export async function fetchShiftJisPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchShiftJisPage failed: ${url} status=${res.status}`);
      return null;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const decoder = new TextDecoder("shift_jis");
    return decoder.decode(bytes);
  } catch (e) {
    console.warn(
      `fetchShiftJisPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** fetch してバイナリを返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
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

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 全角数字・全角記号を半角に変換する。
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 年号文字列と年数字から西暦に変換する。
 * 「元」は 1 年として扱う。
 */
export function eraToWestern(
  era: string,
  yearStr: string,
): number | null {
  const n = yearStr === "元" ? 1 : parseInt(yearStr, 10);
  if (isNaN(n)) return null;
  if (era === "令和") return 2018 + n;
  if (era === "平成") return 1988 + n;
  return null;
}

/**
 * 「令和７年１２月９日」のような日付文字列を YYYY-MM-DD に変換する。
 * 解析できない場合は null を返す。
 */
export function parseDateString(text: string): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const year = eraToWestern(match[1]!, match[2]!);
  if (!year) return null;

  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 相対 URL を絶対 URL に変換する。
 * `/gikai/...` 形式と `../` 形式に対応する。
 */
export function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  // 相対パス
  const base = baseUrl.replace(/\/[^/]*$/, "/");
  return `${base}${href}`;
}
