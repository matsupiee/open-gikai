/**
 * 永平寺町議会 — 共通ユーティリティ
 *
 * サイト: https://www.eiheiji-gikai.jp/
 * PDF ベースの議事録公開。一覧ページから会議 ID を取得し、
 * 各詳細ページから本文 PDF をダウンロードする。
 */

export const BASE_ORIGIN = "https://www.eiheiji-gikai.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

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
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.warn(`[183229-eiheiji] fetchPage 失敗: ${url}`, err instanceof Error ? err.message : err);
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
  } catch (err) {
    console.warn(`[183229-eiheiji] fetchBinary 失敗: ${url}`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * 会議タイトルから和暦の年度を西暦に変換する。
 * e.g., "令和8年1月臨時会" → 2026
 *       "平成28年3月定例会" → 2016
 */
export function extractWesternYear(title: string): number | null {
  // 全角数字を半角に変換
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, eraYearStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}
