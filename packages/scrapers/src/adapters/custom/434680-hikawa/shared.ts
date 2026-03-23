/**
 * 氷川町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.hikawa.kumamoto.jp/gikai/list00412.html
 * 自治体コード: 434680
 */

export const BASE_ORIGIN = "https://www.town.hikawa.kumamoto.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別一覧ページの URL マッピング。
 * 年度 URL は連番ではなく飛び番のため、ハードコードする。
 */
export const YEAR_LIST_URLS: Record<number, string> = {
  2026: `${BASE_ORIGIN}/gikai/list00836.html`, // 令和8年
  2025: `${BASE_ORIGIN}/gikai/list00815.html`, // 令和7年
  2024: `${BASE_ORIGIN}/gikai/list00782.html`, // 令和6年
  2023: `${BASE_ORIGIN}/gikai/list00723.html`, // 令和5年
  2022: `${BASE_ORIGIN}/gikai/list00705.html`, // 令和4年
  2021: `${BASE_ORIGIN}/gikai/list00668.html`, // 令和3年
  2020: `${BASE_ORIGIN}/gikai/list00435.html`, // 令和2年
  2019: `${BASE_ORIGIN}/gikai/list00436.html`, // 平成31年/令和元年
  2018: `${BASE_ORIGIN}/gikai/list00437.html`, // 平成30年
  2017: `${BASE_ORIGIN}/gikai/list00438.html`, // 平成29年
  2016: `${BASE_ORIGIN}/gikai/list00439.html`, // 平成28年
  2015: `${BASE_ORIGIN}/gikai/list00440.html`, // 平成27年
  2014: `${BASE_ORIGIN}/gikai/list00441.html`, // 平成26年
  2013: `${BASE_ORIGIN}/gikai/list00442.html`, // 平成25年
  2012: `${BASE_ORIGIN}/gikai/list00443.html`, // 平成24年
};

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/**
 * 和暦テキストから西暦年を抽出する。
 * 例: "令和6年第2回定例会" → 2024, "平成24年第1回定例会" → 2012
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
