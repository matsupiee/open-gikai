/**
 * 若桜町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.town.wakasa.tottori.jp/soshikikarasagasu/gikaijimukyoku/1/1/524.html
 * 自治体コード: 313254
 *
 * 全ての会議録 PDF が 1 つの HTML ページに集約されており、
 * PDF はテキスト埋め込み型。発言者は「役職（氏名）」形式。
 */

export const LIST_URL =
  "https://www.town.wakasa.tottori.jp/soshikikarasagasu/gikaijimukyoku/1/1/524.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(sessionTitle: string): string {
  if (sessionTitle.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** 全角数字を半角に変換する */
export function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/**
 * 和暦テキスト（例: "令和7年12月定例会"）から西暦年を抽出する。
 */
export function extractWesternYear(text: string): number | null {
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

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[313254-wakasa-tottori] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(
      `[313254-wakasa-tottori] fetchPage 失敗: ${url}`,
      err instanceof Error ? err.message : err,
    );
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
      console.warn(`[313254-wakasa-tottori] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[313254-wakasa-tottori] fetchBinary 失敗: ${url}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
