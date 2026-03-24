/**
 * 出水市議会 議事録検索システム — 共通ユーティリティ
 *
 * サイト: https://www.city.kagoshima-izumi.lg.jp/gikai/gijiroku/
 */

export const BASE_URL = "https://www.city.kagoshima-izumi.lg.jp/gikai/gijiroku";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** fetch して UTF-8 テキストを返す。404 やエラーは null を返す。 */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[izumi] fetchPage failed: ${url}`, e);
    return null;
  }
}

/**
 * 会議録一覧ページの URL を組み立てる。
 * MasterCouncil チェックボックスの ID ではなく、
 * detail_select/{councilId}/1 形式でアクセスする。
 */
export function buildDetailUrl(councilId: number, speakerId = 1): string {
  return `${BASE_URL}/detail_select/${councilId}/${speakerId}`;
}

/**
 * 一覧トップページの URL
 */
export const INDEX_URL = `${BASE_URL}/`;

/**
 * 和暦から西暦に変換する。
 * 変換できない場合は null を返す。
 */
export function japaneseEraToYear(era: string, yearInEra: number): number | null {
  if (era === "令和") return yearInEra + 2018;
  if (era === "平成") return yearInEra + 1988;
  if (era === "昭和") return yearInEra + 1925;
  return null;
}

/** 全角数字を半角数字に変換する */
function normalizeNumbers(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * 日本語の日付文字列から YYYY-MM-DD を抽出する。
 * 全角数字にも対応する。
 * 例: "令和７年11月21日" → "2025-11-21"
 * 変換できない場合は null を返す。
 */
export function parseJapaneseDate(text: string): string | null {
  const normalized = normalizeNumbers(text);
  const m = normalized.match(/(令和|平成|昭和)(元|\d+)年(\d+)月(\d+)日/);
  if (!m) return null;
  const yearInEra = m[2] === "元" ? 1 : parseInt(m[2]!, 10);
  const westernYear = japaneseEraToYear(m[1]!, yearInEra);
  if (westernYear === null) return null;
  const month = parseInt(m[3]!, 10);
  const day = parseInt(m[4]!, 10);
  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 会議タイプを判定する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}
