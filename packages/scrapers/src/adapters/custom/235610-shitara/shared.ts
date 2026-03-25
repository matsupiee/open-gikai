/**
 * 設楽町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.shitara.lg.jp/soshiki/9/1226.html
 *
 * 設楽町は町公式サイトで PDF ベースの議事録を公開している。
 * 単一の一覧ページに全年度・全会議の PDF リンクが掲載されている。
 */

export const BASE_ORIGIN = "https://www.town.shitara.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

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
      signal: AbortSignal.timeout(60_000),
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

/** 全角数字を半角に変換する */
export function normalizeFullWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}

/**
 * 和暦と年数文字列（「元」または数字）を西暦に変換する。
 * e.g., eraToWesternYear("令和", "8") → 2026
 * e.g., eraToWesternYear("平成", "元") → 1989
 */
export function eraToWesternYear(era: string, yearStr: string): number {
  const normalized = normalizeFullWidth(yearStr);
  const eraYear = normalized === "元" ? 1 : parseInt(normalized, 10);
  return eraYear + (era === "平成" ? 1988 : 2018);
}

/** 会議タイプを検出 */
export function detectMeetingType(
  meetingKind: string
): "plenary" | "committee" | "extraordinary" {
  if (meetingKind.includes("委員会")) return "committee";
  if (meetingKind.includes("臨時")) return "extraordinary";
  return "plenary";
}
