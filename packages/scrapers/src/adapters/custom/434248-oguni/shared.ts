/**
 * 小国町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.kumamoto-oguni.lg.jp/ogunitowngikai/gikai_kaigiroku
 * PDF ベースの議事録公開。全 PDF リンクが単一ページ（/23582）に集約されている。
 */

export const BASE_ORIGIN = "https://www.town.kumamoto-oguni.lg.jp";

/** 全 PDF リンクが掲載されている一覧ページ */
export const LIST_PAGE_URL = `${BASE_ORIGIN}/ogunitowngikai/gikai_kaigiroku/23582`;

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
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

const PDF_FETCH_TIMEOUT_MS = 60_000;

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
 * 会議名から会議タイプを検出する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 全角数字を半角数字に変換する。
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和8年" / "令和８年" → 2026, "平成27年" → 2015, "令和元年" → 2019
 * 全角数字にも対応する。
 */
export function parseJapaneseYear(text: string): number | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYearStr = match[2]!;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}
