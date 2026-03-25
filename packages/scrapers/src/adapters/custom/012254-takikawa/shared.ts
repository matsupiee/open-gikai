/**
 * 滝川市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.takikawa.lg.jp/page/2872.html
 *
 * 滝川市は市公式サイト内で PDF ベースの議事録を公開している。
 * トップページから年度別・会議種別ページへのリンクが掲載されており、
 * 各年度別ページに PDF リンクが一覧表示されている。
 */

export const BASE_ORIGIN = "https://www.city.takikawa.lg.jp";

/** 会議録トップページ */
export const TOP_PAGE_URL = `${BASE_ORIGIN}/page/2872.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): "plenary" | "committee" | "extraordinary" {
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

/** fetch して ArrayBuffer を返す（PDF 用） */
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
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 相対 URL または絶対 URL を BASE_ORIGIN を基準に絶対 URL へ変換する。
 */
export function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return `${BASE_ORIGIN}/${href}`;
}

/**
 * 年度別ページ URL からページ ID を抽出する。
 * e.g., "/page/18437.html" → "18437"
 */
export function extractPageId(url: string): string | null {
  const match = url.match(/\/page\/(\d+)\.html/);
  return match ? (match[1] ?? null) : null;
}

/**
 * ページ ID から年度別ページ URL を組み立てる。
 * e.g., "18437" → "https://www.city.takikawa.lg.jp/page/18437.html"
 */
export function buildPageUrl(pageId: string): string {
  return `${BASE_ORIGIN}/page/${pageId}.html`;
}

/**
 * ページ ID から externalId を生成する。
 * e.g., "18437" → "takikawa_18437"
 */
export function buildExternalId(pageId: string, suffix?: string): string {
  return suffix ? `takikawa_${pageId}_${suffix}` : `takikawa_${pageId}`;
}

/**
 * 和暦の年から西暦を計算する。
 * e.g., "令和7" → 2025, "平成16" → 2004
 */
export function eraToWesternYear(era: string, eraYear: number): number {
  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  if (era === "昭和") return eraYear + 1925;
  return eraYear;
}

/**
 * 年度別ページのタイトルから西暦年を抽出する。
 * e.g., "令和7年" → 2025
 * e.g., "令和８年" → 2026
 */
export function extractYearFromTitle(title: string): number | null {
  // 全角数字を半角に変換
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成|昭和)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);

  return eraToWesternYear(era, eraYear);
}

/**
 * リンクテキストから日付（月日）を抽出する。
 * e.g., "12月3日" → { month: 12, day: 3 }
 */
export function extractMonthDay(text: string): { month: number; day: number } | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
  const match = normalized.match(/(\d+)月(\d+)日/);
  if (!match) return null;
  return {
    month: parseInt(match[1]!, 10),
    day: parseInt(match[2]!, 10),
  };
}

/**
 * 年・月・日から YYYY-MM-DD を生成する。
 */
export function buildDateString(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
