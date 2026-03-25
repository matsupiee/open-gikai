/**
 * 御宿町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.onjuku.chiba.jp/sub5/4/gikai/gijiroku/
 * 自治体コード: 124435
 */

export const BASE_ORIGIN = "https://www.town.onjuku.chiba.jp";
export const TOP_PAGE_URL = `${BASE_ORIGIN}/sub5/4/gikai/gijiroku/`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別ページの ID マッピング。
 * 令和年度は数値 ID、平成26年以前は "h{年号}" 形式。
 */
export const YEAR_PAGE_IDS: Record<number, string> = {
  2025: "11",
  2024: "10",
  2023: "9",
  2022: "8",
  2021: "7",
  2020: "6",
  2019: "5",
  2018: "4",
  2017: "3",
  2016: "2",
  2015: "1",
  2014: "h26",
  2013: "h25",
  2012: "h24",
  2011: "h23",
  2010: "h22",
  2009: "h21",
  2008: "h20",
  2007: "h19",
  2006: "h18",
  2005: "h17",
  2004: "h16",
  2003: "h15",
};

/** 年度別ページの URL を組み立てる */
export function buildYearPageUrl(year: number): string | null {
  const pageId = YEAR_PAGE_IDS[year];
  if (!pageId) return null;
  return `${TOP_PAGE_URL}${pageId}.html`;
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/**
 * 和暦テキストから西暦年を抽出する。
 * 例: "令和6年" → 2024, "平成30年" → 2018, "令和元年" → 2019
 */
export function parseWarekiYear(text: string): number | null {
  const reiwa = text.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = text.match(/平成(元|\d+)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

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
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** バイナリデータを fetch して返す（PDF ダウンロード用） */
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

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
