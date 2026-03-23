/**
 * 井川町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.ikawa.akita.jp/site/gikai/
 * 議会だより PDF を単一の一覧ページから収集する。
 */

export const BASE_ORIGIN = "https://www.town.ikawa.akita.jp";

/** 議会だより一覧ページ */
export const LIST_URL = `${BASE_ORIGIN}/site/gikai/1305.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** 和暦を西暦に変換する */
export function convertJapaneseEra(
  era: string,
  eraYearStr: string,
): number | null {
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  if (isNaN(eraYear)) return null;

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  if (era === "昭和") return eraYear + 1925;
  return null;
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
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * PDF URL から externalId 用のキーを抽出する。
 * e.g., "/uploaded/attachment/12345.pdf" → "ikawa_12345"
 */
export function extractExternalId(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/uploaded\/attachment\/(\d+)\.pdf$/i);
  if (!match) return null;
  return `ikawa_${match[1]}`;
}
