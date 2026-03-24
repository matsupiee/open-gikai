/**
 * 今帰仁村議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.nakijin.jp/pagtop/gyosei/songikai/1281.html
 * 自治体コード: 473065
 *
 * 会議録はすべて PDF 形式で公開されており、年度別一覧ページから PDF リンクを収集する。
 * - 議事録トップページから年度別一覧ページへのリンクを辿る
 * - 各年度別一覧ページから PDF リンクを収集する
 */

export const BASE_ORIGIN = "https://www.nakijin.jp";

/** 議事録トップページ URL */
export const TOP_PAGE_URL = `${BASE_ORIGIN}/pagtop/gyosei/songikai/1281.html`;

/** 年度別一覧ページの URL パスプレフィックス */
export const GIJIROKU_PATH_PREFIX = "/pagtop/kakuka/gikai/2/2/2/gijiroku/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const FILE_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会") || title.includes("委員")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
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
      console.warn(`[473065-nakijin] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[473065-nakijin] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（ファイルダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FILE_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[473065-nakijin] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[473065-nakijin] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6年" → 2024, "平成30年" → 2018, "令和元年" → 2019
 */
export function eraToWesternYear(era: string, yearInEra: number): number | null {
  if (era === "令和") return yearInEra + 2018;
  if (era === "平成") return yearInEra + 1988;
  if (era === "昭和") return yearInEra + 1925;
  return null;
}

/**
 * 和暦年文字列から西暦年を返す。
 * 例: "令和6年" → 2024, "平成30年" → 2018, "令和元年" → 2019
 * 変換できない場合は null を返す。
 */
export function parseEraYear(text: string): number | null {
  const m = text.match(/(令和|平成)(元|\d+)年/);
  if (!m) return null;
  const yearInEra = m[2] === "元" ? 1 : parseInt(m[2]!, 10);
  return eraToWesternYear(m[1]!, yearInEra);
}

/**
 * 和暦の日付文字列から YYYY-MM-DD 形式を返す。
 * 例: "令和6年3月5日" → "2024-03-05"
 * 変換できない場合は null を返す。
 */
export function parseEraDate(text: string): string | null {
  const m = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!m) return null;
  const yearInEra = m[2] === "元" ? 1 : parseInt(m[2]!, 10);
  const year = eraToWesternYear(m[1]!, yearInEra);
  if (!year) return null;
  const month = m[3]!.padStart(2, "0");
  const day = m[4]!.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
