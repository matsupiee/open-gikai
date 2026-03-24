/**
 * 妹背牛町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.moseushi.hokkaido.jp/gikai/gijiroku/
 * 自治体コード: 014338
 *
 * 文字コード: UTF-8
 */

export const BASE_ORIGIN = "https://www.town.moseushi.hokkaido.jp";

/** 会議録一覧ページ URL */
export const LIST_PAGE_URL = `${BASE_ORIGIN}/gikai/gijiroku/`;

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
 * 全角数字を半角に変換する。
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
export function eraToWestern(era: string, yearStr: string): number | null {
  const n = yearStr === "元" ? 1 : parseInt(yearStr, 10);
  if (isNaN(n)) return null;
  if (era === "令和") return 2018 + n;
  if (era === "平成") return 1988 + n;
  return null;
}

/**
 * 「令和7年9月」のような日付文字列を YYYY-MM-DD に変換する。
 * 日の指定がない場合は 01 とする。
 * 解析できない場合は null を返す。
 */
export function parseDateString(text: string): string | null {
  const normalized = toHalfWidth(text);

  // 年月日すべて含む場合
  const matchFull = normalized.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (matchFull) {
    const year = eraToWestern(matchFull[1]!, matchFull[2]!);
    if (!year) return null;
    const month = parseInt(matchFull[3]!, 10);
    const day = parseInt(matchFull[4]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 年月のみ
  const matchYM = normalized.match(/(令和|平成)(元|\d+)年(\d{1,2})月/);
  if (matchYM) {
    const year = eraToWestern(matchYM[1]!, matchYM[2]!);
    if (!year) return null;
    const month = parseInt(matchYM[3]!, 10);
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}

/**
 * PDF ファイル名（和暦）から開催日を推定する。
 *
 * パターン:
 *   files/7.9.pdf    → 令和7年9月   → YYYY-MM-01
 *   files/6.9.1.pdf  → 令和6年9月1日
 *   files/31.3.19.pdf → 平成31年3月19日
 *   files/1.9.1.pdf  → 令和元年9月1日（令和は2019年〜、1年=2019）
 */
export function parsePdfFilenameDate(filename: string): string | null {
  // ファイル名部分だけ取り出す
  const basename = filename.split("/").pop() ?? filename;
  const withoutExt = basename.replace(/\.pdf$/i, "");
  const parts = withoutExt.split(".");

  if (parts.length === 2) {
    // 年.月
    const eraYear = parseInt(parts[0]!, 10);
    const month = parseInt(parts[1]!, 10);
    if (isNaN(eraYear) || isNaN(month)) return null;
    const year = eraYearToWestern(eraYear);
    if (!year) return null;
    return `${year}-${String(month).padStart(2, "0")}-01`;
  }

  if (parts.length === 3) {
    // 年.月.日
    const eraYear = parseInt(parts[0]!, 10);
    const month = parseInt(parts[1]!, 10);
    const day = parseInt(parts[2]!, 10);
    if (isNaN(eraYear) || isNaN(month) || isNaN(day)) return null;
    const year = eraYearToWestern(eraYear);
    if (!year) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * 和暦年数から西暦を推定する（令和/平成の自動判定）。
 * 令和は1〜（2019〜）、平成は1〜31（1989〜2019）。
 * 数字だけからは令和 or 平成の判定が困難なため、
 * ≤31 は平成、それ以外 or 1〜7 は令和として扱う。
 * （実際のデータは平成28年〜令和7年なので重複なし）
 */
function eraYearToWestern(n: number): number | null {
  if (n >= 1 && n <= 7) return 2018 + n; // 令和1〜7 → 2019〜2025
  if (n >= 28 && n <= 31) return 1988 + n; // 平成28〜31 → 2016〜2019
  return null;
}

/**
 * 相対 URL を絶対 URL に変換する。
 */
export function resolveUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  // 相対パス
  const base = baseUrl.replace(/\/[^/]*$/, "/");
  return `${base}${href}`;
}
