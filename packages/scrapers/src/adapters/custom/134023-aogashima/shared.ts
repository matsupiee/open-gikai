/**
 * 青ヶ島村議会 — 共通ユーティリティ
 *
 * サイト: https://www.vill.aogashima.tokyo.jp/
 * 広報誌（PDF）内に議決一覧を掲載（会議録検索システムなし）
 */

export const BASE_ORIGIN = "https://www.vill.aogashima.tokyo.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出（青ヶ島村は定例会のみ） */
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
 * 年度別一覧 API の URL を組み立てる。
 * e.g., https://www.vill.aogashima.tokyo.jp/php/press.php?year=2024
 */
export function buildListUrl(year: number): string {
  return `${BASE_ORIGIN}/php/press.php?year=${year}`;
}

/**
 * 広報誌 PDF の URL を組み立てる。
 * e.g., https://www.vill.aogashima.tokyo.jp/press/koho2501.pdf
 */
export function buildPdfUrl(pdfFilename: string): string {
  return `${BASE_ORIGIN}/press/${pdfFilename}`;
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和6年" → 2024, "平成30年" → 2018
 */
export function eraToWesternYear(era: string, eraYear: number): number {
  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return 0;
}
