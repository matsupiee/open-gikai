/**
 * 南三陸町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.minamisanriku.miyagi.jp/gikai/minutes/index.html
 * 自治体コード: 046060
 */

export const BASE_ORIGIN = "https://www.town.minamisanriku.miyagi.jp";

/** 会議録一覧ページのパス */
export const LIST_PATH = "/gikai/minutes/index.html";

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
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[046060-minamisanriku] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[046060-minamisanriku] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/** 会議タイプを検出 */
export function detectMeetingType(
  title: string
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 全角数字を半角数字に変換する。
 */
export function toHankaku(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );
}

/**
 * 和暦の年月日テキストから YYYY-MM-DD 文字列を生成する。
 * 例: "令和６年１２月３日" → "2024-12-03"
 * 例: "令和元年６月１日" → "2019-06-01"
 * 解析できない場合は null を返す。
 */
export function parseWarekiDate(text: string): string | null {
  const normalized = toHankaku(text);

  const reiwa = normalized.match(/(令和)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (reiwa?.[2] && reiwa[3] && reiwa[4]) {
    const n = reiwa[2] === "元" ? 1 : parseInt(reiwa[2], 10);
    const year = 2018 + n;
    const month = parseInt(reiwa[3], 10);
    const day = parseInt(reiwa[4], 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const heisei = normalized.match(/(平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (heisei?.[2] && heisei[3] && heisei[4]) {
    const n = heisei[2] === "元" ? 1 : parseInt(heisei[2], 10);
    const year = 1988 + n;
    const month = parseInt(heisei[3], 10);
    const day = parseInt(heisei[4], 10);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
