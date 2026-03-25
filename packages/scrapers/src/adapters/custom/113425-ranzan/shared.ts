/**
 * 嵐山町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.ranzan.saitama.jp/category/2-19-9-0-0-0-0-0-0-0.html
 * 自治体コード: 113425
 *
 * 自治体 CMS による PDF 公開（専用検索システムなし）。文字コード: UTF-8。
 * 年度別・会議種別ごとに個別ページを設け、PDF を 1 ファイルずつ提供。
 */

export const BASE_ORIGIN = "https://www.town.ranzan.saitama.jp";

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
 * 和暦テキストから西暦年を返す。
 * e.g., "令和6年" → 2024, "令和元年" → 2019, "平成20年" → 2008
 */
export function eraToWesternYear(eraText: string): number | null {
  const match = eraText.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, yearPart] = match;
  const eraYear = yearPart === "元" ? 1 : parseInt(yearPart!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * PDF ファイル名から西暦年を導出する。
 *
 * e.g., "R0709K.pdf" → 2025 (令和7年)
 *       "R0603T.pdf" → 2024 (令和6年)
 */
export function fileNameToYear(fileName: string): number | null {
  const match = fileName.match(/^R(\d{2})\d{2}[A-Z]/i);
  if (!match) return null;

  const eraYear = parseInt(match[1]!, 10);
  return eraYear + 2018; // 令和のみ（現時点で平成分は令和表記なし）
}

/**
 * PDF ファイル名から月を導出する。
 *
 * e.g., "R0709K.pdf" → 9
 *       "R0603T.pdf" → 3
 */
export function fileNameToMonth(fileName: string): number | null {
  const match = fileName.match(/^R\d{2}(\d{2})[A-Z]/i);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

/**
 * 会議種別を検出する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}
