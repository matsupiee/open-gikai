/**
 * 平川市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.hirakawa.lg.jp/jouhou/gikai/nittei/kaigiroku.html
 * PDF ベースの議事録公開。単一 HTML ページに全年度の PDF リンクを一括掲載。
 */

export const BASE_ORIGIN = "https://www.city.hirakawa.lg.jp";
export const LIST_PATH = "/jouhou/gikai/nittei/kaigiroku.html";

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
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和７年" → 2025, "平成30年" → 2018, "令和元年" → 2019
 */
export function eraToWestern(era: string, eraYear: string): number | null {
  const y = eraYear === "元" ? 1 : Number(eraYear);
  if (Number.isNaN(y)) return null;
  if (era === "令和") return y + 2018;
  if (era === "平成") return y + 1988;
  return null;
}
