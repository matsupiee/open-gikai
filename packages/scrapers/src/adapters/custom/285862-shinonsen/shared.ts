/**
 * 新温泉町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.shinonsen.hyogo.jp/page/index.php?mode=page_list&cate_id=C2608
 * 自治体コード: 285862
 */

export const BASE_ORIGIN = "https://www.town.shinonsen.hyogo.jp";

/** 会議録一覧トップ URL */
export const TOP_URL = `${BASE_ORIGIN}/page/index.php?mode=page_list&cate_id=C2608`;

/** 年度別ページの既知ページ ID テーブル */
export const KNOWN_YEAR_PAGE_IDS: Record<string, number> = {
  "1f8d048596a66797df1d173524b96774": 2025, // 令和7年
  af9ab8aa1dea47aa7384e22d170bf14e: 2024, // 令和6年
  "4341ff1fa358ee5d8a8c229f91604c96": 2023, // 令和5年
  "436c71e7349dc5800e035c09d03c69d1": 2022, // 令和4年
  "513c2a1095ea539cc510705b75456d55": 2021, // 令和3年
  "478d12f269352131943806bc852f522d": 2020, // 令和2年
  d85d4755d33ed6da569e81d517f8934d: 2019, // 平成31年・令和元年
  a6b34f6baad340b69552dcafb7acdda2: 2018, // 平成30年
};

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

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
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
 * 和暦テキストから西暦を返す。
 * 例: "令和7年" -> 2025, "令和元年" -> 2019, "平成30年" -> 2018
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

/**
 * 和暦日付文字列から YYYY-MM-DD を返す。
 * 例: "令和7年3月10日" -> "2025-03-10"
 */
export function parseWarekiDate(text: string): string | null {
  const m = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!m) return null;

  const era = m[1]!;
  const eraYearStr = m[2]!;
  const month = parseInt(m[3]!, 10);
  const day = parseInt(m[4]!, 10);

  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  const calendarYear = era === "令和" ? 2018 + eraYear : 1988 + eraYear;

  return `${calendarYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
