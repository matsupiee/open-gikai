/**
 * 高浜市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.takahama.lg.jp/site/gikai/1529.html
 * 自治体コード: 232271
 *
 * 会議録は PDF 形式で公開。定例会・臨時会は単一ページに全年度が掲載。
 * 委員会・特別委員会は一覧ページから個別ページへの 2 段階取得。
 */

export const BASE_ORIGIN = "https://www.city.takahama.lg.jp";

/** 定例会 会議録ページ */
export const TEIREIKAI_URL = `${BASE_ORIGIN}/site/gikai/1529.html`;
/** 臨時会 会議録ページ */
export const RINJI_URL = `${BASE_ORIGIN}/site/gikai/16707.html`;
/** 委員会 会議録一覧ページ */
export const IINKAI_INDEX_URL = `${BASE_ORIGIN}/site/gikai/1497.html`;
/** 特別委員会 会議録一覧ページ */
export const TOKUBETSU_INDEX_URL = `${BASE_ORIGIN}/site/gikai/2050.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 和暦タイトル/見出しから西暦年と月を抽出する。
 *
 * 対応パターン:
 *   令和X年   → 2018 + X
 *   令和元年  → 2019
 *   平成XX年  → 1988 + XX
 */
export function extractYearMonth(text: string): { year: number; month: number | null } {
  // 令和 + 月
  const reiwaMonthMatch = text.match(/令和(元|\d+)年(\d+)月/);
  if (reiwaMonthMatch) {
    const nengo = reiwaMonthMatch[1] === "元" ? 1 : parseInt(reiwaMonthMatch[1]!, 10);
    return { year: 2018 + nengo, month: parseInt(reiwaMonthMatch[2]!, 10) };
  }
  // 令和 (月なし)
  const reiwaMatch = text.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const nengo = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    return { year: 2018 + nengo, month: null };
  }
  // 平成 + 月
  const heiseiMonthMatch = text.match(/平成(\d+)年(\d+)月/);
  if (heiseiMonthMatch) {
    return {
      year: 1988 + parseInt(heiseiMonthMatch[1]!, 10),
      month: parseInt(heiseiMonthMatch[2]!, 10),
    };
  }
  // 平成 (月なし)
  const heiseiMatch = text.match(/平成(\d+)年/);
  if (heiseiMatch) {
    return { year: 1988 + parseInt(heiseiMatch[1]!, 10), month: null };
  }

  return { year: 0, month: null };
}

/**
 * 年・月から YYYY-MM-01 形式の日付文字列を構築する。
 * 月が不明な場合は YYYY-01-01 を返す。
 * 年が 0 の場合は空文字列を返す。
 */
export function buildHeldOn(year: number, month: number | null): string {
  if (!year) return "";
  const m = month ?? 1;
  return `${year}-${String(m).padStart(2, "0")}-01`;
}

/**
 * テキストから会議種別を判定する。
 */
export function detectMeetingType(text: string): string {
  if (text.includes("委員会")) return "committee";
  if (text.includes("臨時会") || text.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 相対パスを絶対 URL に変換する。
 */
export function resolveUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return `${BASE_ORIGIN}/${href}`;
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[232271-takahama] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[232271-takahama] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** バイナリデータを取得する */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      console.warn(`[232271-takahama] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[232271-takahama] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
