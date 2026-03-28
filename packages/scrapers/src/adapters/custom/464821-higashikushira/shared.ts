/**
 * 東串良町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.higashikushira.com/docs/2018012400051/
 * 自治体コード: 464821
 *
 * SHIRASAGI CMS の単一ページに年度別 PDF がまとまっている構成。
 */

export const BASE_ORIGIN = "https://www.higashikushira.com";
export const LIST_PAGE_URL = `${BASE_ORIGIN}/docs/2018012400051/`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出する */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
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
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** 全角数字を半角数字に変換する */
export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

/** 和暦を西暦に変換する */
export function eraToWesternYear(era: string, eraYearText: string): number | null {
  const normalized = toHalfWidth(eraYearText);
  const eraYear = normalized === "元" ? 1 : Number(normalized);
  if (Number.isNaN(eraYear)) return null;

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 和暦の見出しから西暦年を返す。
 * 例: "令和6年" → 2024, "平成29年" → 2017, "令和元年" → 2019
 */
export function convertWarekiToWesternYear(text: string): number | null {
  const normalized = toHalfWidth(text).replace(/\s+/g, "");
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  return eraToWesternYear(match[1]!, match[2]!);
}

/**
 * 日本語の日付文字列から YYYY-MM-DD を抽出する。
 * 例: "令和6年3月7日" → "2024-03-07"
 */
export function parseJapaneseDate(text: string): string | null {
  const normalized = toHalfWidth(text).replace(/\s+/g, "");
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const year = eraToWesternYear(match[1]!, match[2]!);
  if (year === null) return null;

  const month = Number(match[3]);
  const day = Number(match[4]);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 一覧ページ URL を組み立てる */
export function buildListUrl(baseUrl = LIST_PAGE_URL): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}

/** PDF の URL を組み立てる */
export function buildDocumentUrl(path: string, baseUrl = LIST_PAGE_URL): string {
  return new URL(path, buildListUrl(baseUrl)).toString();
}
