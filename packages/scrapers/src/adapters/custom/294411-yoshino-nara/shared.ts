/**
 * 吉野町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.yoshino.nara.jp/gikai/kaigiroku/index.html
 * 自治体コード: 294411
 */

export const BASE_ORIGIN = "https://www.town.yoshino.nara.jp";

/** 年度別ページ ID 一覧（西暦 → ページID） */
export const YEAR_PAGE_MAP: Record<number, number> = {
  2016: 1239, // 平成28年
  2017: 1240, // 平成29年
  2018: 1241, // 平成30年
  2019: 1248, // 平成31年（令和元年）
  2020: 1249, // 令和2年
  2021: 1250, // 令和3年
  2022: 1251, // 令和4年
  2023: 1252, // 令和5年
  2024: 1342, // 令和6年
  2025: 1570, // 令和7年
  2026: 1870, // 令和8年
};

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

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6年" → 2024, "令和元年" → 2019, "平成23年" → 2011
 */
export function parseWarekiYear(text: string): number | null {
  const reiwaGen = text.match(/令和元年/);
  if (reiwaGen) return 2019;

  const reiwa = text.match(/令和(\d+)年/);
  if (reiwa?.[1]) {
    return 2018 + parseInt(reiwa[1], 10);
  }

  const heisei = text.match(/平成(\d+)年/);
  if (heisei?.[1]) {
    return 1988 + parseInt(heisei[1], 10);
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
      console.warn(`[294411-yoshino-nara] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[294411-yoshino-nara] fetchPage error: ${url}`,
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
      console.warn(`[294411-yoshino-nara] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[294411-yoshino-nara] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
