/**
 * つがる市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.tsugaru.aomori.jp/soshiki/shigikai/kaigiroku/index.html
 * 自治体コード: 022098
 */

export const BASE_ORIGIN = "https://www.city.tsugaru.aomori.jp";
export const INDEX_PATH = "/soshiki/shigikai/kaigiroku/index.html";

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
    console.warn(`[022098-tsugaru] fetchPage failed: ${url}`, e);
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
    console.warn(`[022098-tsugaru] fetchBinary failed: ${url}`, e);
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

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 和暦年を西暦年に変換する。
 * 例: "令和7" → 2025, "平成25" → 2013
 */
export function wareki2seireki(era: string, yearNum: number): number {
  if (era === "令和") return 2018 + yearNum;
  if (era === "平成") return 1988 + yearNum;
  return yearNum;
}

/**
 * テキストから和暦の日付を抽出して YYYY-MM-DD 形式に変換する。
 * 全角・半角数字の両方に対応する。
 * 例: "令和7年3月10日" → "2025-03-10"
 *     "平成25年６月１日" → "2013-06-01"
 */
export function parseJapaneseDate(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);
  const westernYear = wareki2seireki(era, eraYear);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
