/**
 * 北竜町議会 会議録 — 共通ユーティリティ
 *
 * サイト: http://www.town.hokuryu.hokkaido.jp/tyousei/gikai/gikaikaigiroku/
 * 自治体コード: 014371
 */

export const BASE_ORIGIN = "http://www.town.hokuryu.hokkaido.jp";

/** トップページ（最新年度・令和7年）*/
export const TOP_URL = `${BASE_ORIGIN}/tyousei/gikai/gikaikaigiroku/`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
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
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 全角数字を半角に変換する。
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0)
  );
}

/**
 * 和暦の日付テキストを YYYY-MM-DD に変換する。
 * 対応パターン: 「令和X年X月X日」「平成X年X月X日」
 */
export function convertWarekiDateToISO(text: string): string | null {
  const normalized = toHalfWidth(text);

  const reiwaMatch = normalized.match(/令和(元|\d+)年(\d+)月(\d+)日/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    const month = parseInt(reiwaMatch[2]!, 10);
    const day = parseInt(reiwaMatch[3]!, 10);
    const westernYear = 2018 + eraYear;
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const heiseiMatch = normalized.match(/平成(\d+)年(\d+)月(\d+)日/);
  if (heiseiMatch) {
    const eraYear = parseInt(heiseiMatch[1]!, 10);
    const month = parseInt(heiseiMatch[2]!, 10);
    const day = parseInt(heiseiMatch[3]!, 10);
    const westernYear = 1988 + eraYear;
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/**
 * PDF の相対 href を絶対 URL に変換する。
 *
 * `/../../coupl/2025/09/g_giroku_r7.3.11.pdf` のような形式を
 * `http://www.town.hokuryu.hokkaido.jp/coupl/2025/09/g_giroku_r7.3.11.pdf` に変換する。
 */
export function resolveHref(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  // `/../../coupl/...` → `/coupl/...` へ正規化してから BASE_ORIGIN を付与
  const withoutDots = href.replace(/^(\/\.\.)+/, "");
  const normalizedPath = withoutDots.startsWith("/")
    ? withoutDots
    : `/${withoutDots}`;
  return `${BASE_ORIGIN}${normalizedPath}`;
}
