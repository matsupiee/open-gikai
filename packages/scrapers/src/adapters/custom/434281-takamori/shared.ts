/**
 * 高森町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.kumamoto-takamori.lg.jp/site/gikai/list32-138.html
 *
 * 高森町は町公式サイト内で PDF ベースの議事録を年度別ページに公開している。
 * 会議録一覧ページから年度別ページへのリンクを収集し、
 * 各年度別ページから PDF リンクを取得する。
 */

export const BASE_ORIGIN = "https://www.town.kumamoto-takamori.lg.jp";

/** 会議録一覧ページ */
export const LIST_URL = `${BASE_ORIGIN}/site/gikai/list32-138.html`;

/** 年度別ページ ID 一覧（令和7年〜平成13年） */
export const YEAR_PAGE_IDS: Record<number, number> = {
  2025: 5910, // 令和7年
  2024: 5909, // 令和6年
  2023: 5908, // 令和5年
  2022: 5907, // 令和4年
  2021: 5906, // 令和3年
  2020: 5905, // 令和2年
  2019: 5904, // 平成31年（令和元年）
  2018: 5903, // 平成30年
  2017: 5902, // 平成29年
  2016: 5901, // 平成28年
  2015: 5900, // 平成27年
  2014: 5899, // 平成26年
  2013: 5898, // 平成25年
  2012: 5897, // 平成24年
  2011: 5896, // 平成23年
  2010: 5895, // 平成22年
  2009: 5894, // 平成21年
  2008: 5893, // 平成20年
  2007: 5892, // 平成19年
  2006: 5891, // 平成18年
  2005: 5890, // 平成17年
  2004: 5889, // 平成16年
  2003: 5888, // 平成15年
  2002: 5887, // 平成14年
  2001: 5885, // 平成13年
};

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
 * 年度別ページ URL を組み立てる。
 * e.g., 5909 → "https://www.town.kumamoto-takamori.lg.jp/site/gikai/5909.html"
 */
export function buildYearPageUrl(pageId: number): string {
  return `${BASE_ORIGIN}/site/gikai/${pageId}.html`;
}

/**
 * 添付 ID から PDF URL を組み立てる。
 * e.g., "123456" → "https://www.town.kumamoto-takamori.lg.jp/uploaded/attachment/123456.pdf"
 */
export function buildPdfUrl(attachmentId: string): string {
  return `${BASE_ORIGIN}/uploaded/attachment/${attachmentId}.pdf`;
}

/**
 * タイトルから西暦年を抽出する。
 * e.g., "令和6年第1回臨時会（1月）" → 2024
 * e.g., "平成30年第4回定例会（12月）" → 2018
 */
export function extractYearFromTitle(title: string): number | null {
  // 全角数字を半角に変換
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);

  return eraYear + (era === "平成" ? 1988 : 2018);
}

/**
 * 和暦の日付文字列から YYYY-MM-DD を抽出する。
 * e.g., "令和６年９月９日" → "2024-09-09"
 * 全角数字・半角数字の両方に対応する。
 */
export function parseJapaneseDate(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  const westernYear = eraYear + (era === "平成" ? 1988 : 2018);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * タイトルから開催月を抽出する。
 * e.g., "令和6年第1回臨時会（1月）" → 1
 * e.g., "令和6年第1回定例会（3月）（1）" → 3
 */
export function extractMonthFromTitle(title: string): number | null {
  // 全角数字を半角に変換
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/（(\d+)月）/);
  if (!match) return null;

  return parseInt(match[1]!, 10);
}

/**
 * タイトルと年・月から heldOn (YYYY-MM-01) を推定する。
 * 正確な日は PDF 内からしか取得できないため、月初として返す。
 */
export function estimateHeldOn(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
