/**
 * 鋸南町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.kyonan.chiba.jp/site/machigikai/list23.html
 * 自治体コード: 124630
 */

export const BASE_ORIGIN = "https://www.town.kyonan.chiba.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別一覧ページの URL マッピング。
 * ページ ID は連番ではないため、ドキュメントに基づきハードコードする。
 */
export const YEAR_PAGE_IDS: Record<number, string> = {
  2025: "0012731",
  2024: "0011781",
  2023: "9459",
  2022: "8301",
  2021: "5693",
  2020: "2746",
  2019: "2745",
  2018: "2748",
  2017: "2749",
  2016: "2751",
  2015: "2765",
  2014: "2766",
  2013: "2767",
  2012: "2768",
};

/** 年度別一覧ページの URL を組み立てる */
export function buildYearPageUrl(year: number): string | null {
  const pageId = YEAR_PAGE_IDS[year];
  if (!pageId) return null;
  return `${BASE_ORIGIN}/site/machigikai/${pageId}.html`;
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/**
 * 和暦テキストから西暦年を抽出する。
 * 例: "令和6年第1回定例会" → 2024, "平成30年第3回定例会" → 2018
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
