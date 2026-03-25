/**
 * 蓬田村議会 — 共通ユーティリティ
 *
 * サイト: https://www.vill.yomogita.lg.jp/sonsei/gikai/gijiroku.html
 */

export const BASE_URL = "https://www.vill.yomogita.lg.jp/sonsei/gikai";
export const LIST_URL = `${BASE_URL}/gijiroku.html`;

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
    console.warn(`[yomogita] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリ (ArrayBuffer) を返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[yomogita] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/**
 * 会議タイトルから会議種別を判定する。
 */
export function detectMeetingType(title: string): "plenary" | "committee" | "extraordinary" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 全角数字を半角数字に変換する。
 */
export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * リンクテキスト内の年度（h2 見出し「令和X年」）から西暦年を計算する。
 * 「令和元年」 → 2019
 * 解析できない場合は null を返す。
 */
export function parseEraYear(yearText: string): number | null {
  const normalized = toHalfWidth(yearText);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  return eraYear + (era === "平成" ? 1988 : 2018);
}
