/**
 * 南種子町議会 会議録 — 共通ユーティリティ
 *
 * サイト: http://www.town.minamitane.kagoshima.jp/
 * 自治体コード: 465020
 *
 * 会議録一覧ページから PDF リンクを収集し、各 PDF を取得・解析する。
 * HTTP のみ対応（HTTPS は接続拒否）。Imperva CDN を使用。
 */

export const BASE_ORIGIN = "http://www.town.minamitane.kagoshima.jp";

/** 会議録一覧ページ URL */
export const LIST_PAGE_URL = `${BASE_ORIGIN}/industry/assembly/minutes.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
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
      console.warn(`[465020-minamitane] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[465020-minamitane] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
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
      console.warn(`[465020-minamitane] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[465020-minamitane] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6年" → 2024, "平成30年" → 2018, "令和元年" → 2019
 * 変換できない場合は null を返す。
 */
export function eraToWesternYear(era: string, yearInEra: number): number | null {
  if (era === "令和") return yearInEra + 2018;
  if (era === "平成") return yearInEra + 1988;
  if (era === "昭和") return yearInEra + 1925;
  return null;
}

/**
 * 和暦年文字列から西暦年を返す。
 * 例: "令和6年" → 2024, "平成27年" → 2015, "令和元年" → 2019
 * 変換できない場合は null を返す。
 */
export function parseEraYear(text: string): number | null {
  const m = text.match(/(令和|平成)(元|\d+)年/);
  if (!m) return null;
  const yearInEra = m[2] === "元" ? 1 : parseInt(m[2]!, 10);
  return eraToWesternYear(m[1]!, yearInEra);
}
