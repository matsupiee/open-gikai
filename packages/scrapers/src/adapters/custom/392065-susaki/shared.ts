/**
 * 須崎市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.susaki.lg.jp/gijiroku/
 * 自治体コード: 392065
 */

export const BASE_URL = "https://www.city.susaki.lg.jp/gijiroku";
export const BASE_ORIGIN = "https://www.city.susaki.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** スクレイピング対象のカテゴリコード */
export const CATEGORIES = ["3000", "4000"] as const;
export type Category = (typeof CATEGORIES)[number];

/**
 * 年度リスト（令和 2〜8 年、平成 18〜31 年）
 */
export const YEAR_LIST: { gengou: string; year: string; westernYear: number }[] = [
  // 令和
  { gengou: "令和", year: "8", westernYear: 2026 },
  { gengou: "令和", year: "7", westernYear: 2025 },
  { gengou: "令和", year: "6", westernYear: 2024 },
  { gengou: "令和", year: "5", westernYear: 2023 },
  { gengou: "令和", year: "4", westernYear: 2022 },
  { gengou: "令和", year: "3", westernYear: 2021 },
  { gengou: "令和", year: "2", westernYear: 2020 },
  // 平成
  { gengou: "平成", year: "31", westernYear: 2019 },
  { gengou: "平成", year: "30", westernYear: 2018 },
  { gengou: "平成", year: "29", westernYear: 2017 },
  { gengou: "平成", year: "28", westernYear: 2016 },
  { gengou: "平成", year: "27", westernYear: 2015 },
  { gengou: "平成", year: "26", westernYear: 2014 },
  { gengou: "平成", year: "25", westernYear: 2013 },
  { gengou: "平成", year: "24", westernYear: 2012 },
  { gengou: "平成", year: "23", westernYear: 2011 },
  { gengou: "平成", year: "22", westernYear: 2010 },
  { gengou: "平成", year: "21", westernYear: 2009 },
  { gengou: "平成", year: "20", westernYear: 2008 },
  { gengou: "平成", year: "19", westernYear: 2007 },
  { gengou: "平成", year: "18", westernYear: 2006 },
];

/**
 * 年度一覧ページを POST で取得する。
 *
 * 年度切り替えは JavaScript フォーム送信（fncYearSet）のため、
 * hidden フィールド（hdngo, hdnYear）を POST パラメータとして送信する。
 */
export async function fetchListPage(
  category: Category,
  gengou: string,
  year: string
): Promise<string | null> {
  try {
    const body = new URLSearchParams({
      hdnKatugi: category,
      hdngo: gengou,
      hdnYear: year,
    });

    const res = await fetch(`${BASE_URL}/`, {
      method: "POST",
      headers: {
        "User-Agent": USER_AGENT,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!res.ok) {
      console.warn(`[392065-susaki] fetchListPage failed: category=${category} ${gengou}${year} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[392065-susaki] fetchListPage error: category=${category} ${gengou}${year}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[392065-susaki] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[392065-susaki] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e
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
      console.warn(`[392065-susaki] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[392065-susaki] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 会議タイトルから meetingType を判定する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}
