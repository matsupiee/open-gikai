/**
 * 芸西村議会 — 共通ユーティリティ
 *
 * サイト: https://www.vill.geisei.kochi.jp/a02b07.php
 * PDF ベースの議事録公開。年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.vill.geisei.kochi.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 年度ページ ID マッピング（西暦 → ページ ID） */
const YEAR_PAGE_MAP: Record<number, string> = {
  2026: "m001917", // 令和8年
  2025: "m001764", // 令和7年
  2024: "m001586", // 令和6年
  2023: "m001459", // 令和5年
  2022: "m001237", // 令和4年
  2021: "m001117", // 令和3年
  2020: "m000939", // 令和2年
  2019: "m000785", // 平成31年/令和元年
};

/** 年度ページ URL を構築 */
export function buildYearPageUrl(year: number): string | null {
  const pageId = YEAR_PAGE_MAP[year];
  if (!pageId) return null;
  return `${BASE_ORIGIN}/pages/${pageId}.php`;
}

/** 会議タイプを検出 */
export function detectMeetingType(section: string): string {
  if (section.includes("臨時")) return "extraordinary";
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
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e
    );
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
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/pbfile/m001764/pbf20250715141530.pdf" → "m001764_pbf20250715141530"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/(m\d+)\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return `${match[1]}_${match[2]}`;
}
