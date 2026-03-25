/**
 * 中川村議会 — 共通ユーティリティ
 *
 * サイト: https://www.vill.nakagawa.nagano.jp/site/gikai/list30-185.html
 * PDF ベースの議事録公開。全定例会・臨時会が単一ページに集約されている。
 */

export const BASE_ORIGIN = "https://www.vill.nakagawa.nagano.jp";

export const LIST_URL =
  "https://www.vill.nakagawa.nagano.jp/site/gikai/list30-185.html";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和7" → 2025, "平成17" → 2005, "令和元" → 2019
 */
export function eraToWesternYear(era: string, eraYear: string): number | null {
  const year = eraYear === "元" ? 1 : Number(eraYear);
  if (Number.isNaN(year)) return null;

  if (era === "令和") return year + 2018;
  if (era === "平成") return year + 1988;
  return null;
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
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
