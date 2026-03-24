/**
 * 三沢市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.misawa.lg.jp/index.cfm/24,11423,118,420,html
 * 自治体コード: 022071
 */

export const BASE_ORIGIN = "https://www.city.misawa.lg.jp";
export const LIST_PATH = "/index.cfm/24,11423,118,420,html";

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
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[022071-misawa] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[022071-misawa] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/** 会議タイプを検出 */
export function detectMeetingType(
  title: string
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和元年" → 2019, "令和7年" → 2025, "平成31年" → 2019
 */
export function eraToWestern(era: string, eraYear: string): number | null {
  const y = eraYear === "元" ? 1 : Number(eraYear);
  if (Number.isNaN(y)) return null;
  if (era === "令和") return y + 2018;
  if (era === "平成") return y + 1988;
  return null;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
