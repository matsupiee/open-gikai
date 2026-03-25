/**
 * 土佐清水市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.tosashimizu.kochi.jp/kurashi/section/gikai/042.html
 * PDF ベースの議会情報公開（一覧ページから詳細ページ経由で PDF を直接配布）。
 */

export const BASE_ORIGIN = "https://www.city.tosashimizu.kochi.jp";
export const LIST_URL = `${BASE_ORIGIN}/kurashi/section/gikai/042.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
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
 * 和暦テキストから西暦年に変換する。
 * 元年対応あり。
 *
 * e.g., "令和", 1 → 2019
 *       "平成", "元" → 1989
 */
export function eraToWesternYear(era: string, eraYearStr: string): number | null {
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  if (isNaN(eraYear)) return null;

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/** 全角数字を半角数字に変換する */
export function normalizeDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String(String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30))
  );
}

/**
 * PDF URL から externalId 用のキーを抽出する。
 * e.g., "/fs/1/2/3/4/5/6/_/R7.6.9saikaibi.pdf" → "tosashimizu_1_2_3_4_5_6_R7.6.9saikaibi"
 */
export function extractExternalIdKey(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/fs\/(.+?)\/_\/([^/]+)\.pdf$/i);
  if (!match) return null;
  const path = match[1]!.replace(/\//g, "_");
  const filename = match[2]!;
  return `tosashimizu_${path}_${filename}`;
}
