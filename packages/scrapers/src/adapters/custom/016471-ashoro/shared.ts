/**
 * 足寄町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.ashoro.hokkaido.jp/gikai/kaigiroku/
 * PDF ベースの議事録公開。単一の一覧ページに全年度分が掲載。
 */

export const BASE_ORIGIN = "https://www.town.ashoro.hokkaido.jp";

/** 一覧ページ URL */
export const LIST_PAGE_URL = `${BASE_ORIGIN}/gikai/kaigiroku/page_6.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(category: string): string {
  if (category.includes("委員会")) return "committee";
  if (category.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

/**
 * 全角数字を半角数字に変換する。
 * e.g., "７" → "7", "２９" → "29"
 */
export function normalizeNumbers(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦テキストから西暦年を返す。
 * 全角数字にも対応する。
 * e.g., "令和7年" → 2025, "令和７年" → 2025, "平成29年" → 2017
 */
export function eraToWesternYear(eraText: string): number | null {
  const normalized = normalizeNumbers(eraText);
  const match = normalized.match(/(令和|平成)(\d+)年/);
  if (!match) return null;

  const [, era, yearStr] = match;
  const eraYear = parseInt(yearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/gikai/assets/r7t1kaigiroku3.4.pdf" → "r7t1kaigiroku3.4"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}
