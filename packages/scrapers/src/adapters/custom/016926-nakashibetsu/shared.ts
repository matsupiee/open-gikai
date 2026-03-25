/**
 * 中標津町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.nakashibetsu.jp/gikai/
 *
 * 中標津町は一般質問・意見書を PDF 形式で公開している。
 * 会議録検索システムは未導入のため、カスタムアダプターとして実装する。
 */

export const BASE_ORIGIN = "https://www.nakashibetsu.jp";
export const IPPAN_PATH = "/gikai/ippansitumon-ikensyo/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

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
 * 西暦年から年度コードを返す。
 * e.g., 2024 → "reiwa6", 2025 → "reiwa07"
 *
 * 令和7年以降は reiwa07 のようにゼロ埋め、令和6年以前は reiwa6 のようにゼロ埋めなし。
 */
export function yearToEraCode(year: number): string | null {
  if (year >= 2019) {
    const eraYear = year - 2018;
    if (eraYear >= 7) {
      return `reiwa${String(eraYear).padStart(2, "0")}`;
    }
    return `reiwa${eraYear}`;
  }
  return null;
}

/**
 * 定例会コードのパターン（URLパスから年・月を抽出）
 * e.g., R0703teireikai → { year: 7, month: 3 }
 *       R2209teirei → { year: 22, month: 9 }
 */
export function parseSessionCode(code: string): {
  eraYear: number;
  month: number;
} | null {
  const match = code.match(/R(\d{2})(\d{2})teire(?:ikai|i)/i);
  if (!match) return null;
  return {
    eraYear: parseInt(match[1]!, 10),
    month: parseInt(match[2]!, 10),
  };
}

/**
 * 令和元号年 → 西暦年
 * e.g., 6 → 2024, 1 → 2019
 */
export function reiwaToWestern(eraYear: number): number {
  return eraYear + 2018;
}

/**
 * 会議タイプを検出
 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * PDF ファイル名から externalId 用のキーを抽出する。
 * e.g., "/file/contents/5857/48136/abc.pdf" → "abc"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/([^/]+)\.pdf$/i);
  if (!match?.[1]) return null;
  return match[1];
}
