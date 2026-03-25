/**
 * 塩竈市議会（宮城県）会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.shiogama.miyagi.jp/life/5/36/182/
 * 自治体コード: 042030
 *
 * 全て PDF 形式で公開。4つの一覧ページから PDF リンクを収集する。
 */

export const BASE_ORIGIN = "https://www.city.shiogama.miyagi.jp";

/** 4つの一覧ページ URL */
export const LIST_PAGE_URLS = [
  `${BASE_ORIGIN}/soshiki/2/2578.html`, // 定例会・特別委員会
  `${BASE_ORIGIN}/soshiki/2/6884.html`, // 常任委員会
  `${BASE_ORIGIN}/soshiki/2/47219.html`, // 全員協議会
  `${BASE_ORIGIN}/soshiki/2/30644.html`, // 長期総合計画特別委員会
];

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
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 和暦テキストから西暦年を返す。
 * e.g., "令和7年" → 2025, "令和元年" → 2019, "平成16年" → 2004
 */
export function eraToWesternYear(eraText: string): number | null {
  const match = eraText.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, yearPart] = match;
  const eraYear = yearPart === "元" ? 1 : parseInt(yearPart!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 会議種別を検出する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * テキストから開催日 YYYY-MM-DD を解析する。
 * パターン: "令和7年12月12日" / "平成16年3月5日"
 * 解析できない場合は null を返す。
 */
export function parseDateFromText(text: string): string | null {
  const fullMatch = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!fullMatch) return null;

  const year = eraToWesternYear(`${fullMatch[1]}${fullMatch[2]}年`);
  if (!year) return null;

  const month = parseInt(fullMatch[3]!, 10);
  const day = parseInt(fullMatch[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * テキストから年度のみを解析する（日付なしのパターン用）。
 * e.g., "令和7年第4回定例会" → { year: 2025, approxDate: "2025-01-01" }
 * 解析できない場合は null を返す。
 */
export function parseYearOnlyFromText(text: string): number | null {
  const match = text.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWesternYear(`${match[1]}${match[2]}年`);
}
