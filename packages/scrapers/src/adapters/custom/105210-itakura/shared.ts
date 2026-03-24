/**
 * 板倉町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.itakura.gunma.jp/d000070/d000030/index.html
 * 自治体コード: 105210
 */

export const BASE_ORIGIN = "https://www.town.itakura.gunma.jp";

/** 会議録一覧のベース URL */
export const LIST_BASE_URL = `${BASE_ORIGIN}/d000070/d000030/index.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 西暦年から年度別ページのパスセグメントを返す。
 *
 * 各年度と d000NNN の対応はサイト上で確認した固定マッピング。
 * 令和元年（2019年）は平成31年も兼ねるため d000130 を使用。
 */
export function yearToPathSegment(year: number): string | null {
  const map: Record<number, string> = {
    2026: "d000200",
    2025: "d000190",
    2024: "d000180",
    2023: "d000170",
    2022: "d000160",
    2021: "d000150",
    2020: "d000140",
    2019: "d000130", // 令和元年・平成31年
    2018: "d000120",
    2017: "d000110",
    2016: "d000100",
    2015: "d000090",
    2014: "d000080",
    2013: "d000010",
    2012: "d000020",
    2011: "d000030",
    2010: "d000040",
    2009: "d000050",
    2008: "d000060",
    2007: "d000070",
  };
  return map[year] ?? null;
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
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
      signal: AbortSignal.timeout(120_000),
    });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和7年" -> 2025, "令和元年" -> 2019
 */
export function parseWarekiYear(text: string): number | null {
  const reiwa = text.match(/令和(\d+|元)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = text.match(/平成(\d+|元)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
