/**
 * 水巻町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.mizumaki.lg.jp/li/gyosei/030/010/
 * 自治体コード: 403822
 */

export const BASE_ORIGIN = "https://www.town.mizumaki.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

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
      signal: AbortSignal.timeout(60_000),
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
 * 例: "令和7年" -> 2025, "令和元年" -> 2019, "平成30年" -> 2018
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

/**
 * 年度コードと西暦年のマッピング
 * 年度コードは 10 刻みの3桁数値
 */
export const NENDO_CODE_MAP: Record<string, number> = {
  "010": 2006, // 平成18年
  "020": 2007, // 平成19年
  "030": 2008, // 平成20年
  "040": 2009, // 平成21年
  "050": 2010, // 平成22年
  "060": 2011, // 平成23年
  "070": 2012, // 平成24年
  "080": 2013, // 平成25年
  "090": 2014, // 平成26年
  "100": 2015, // 平成27年
  "110": 2016, // 平成28年
  "120": 2017, // 平成29年
  "130": 2018, // 平成30年
  "140": 2019, // 令和元年
  "150": 2020, // 令和2年
  "160": 2021, // 令和3年
  "170": 2022, // 令和4年
  "180": 2023, // 令和5年
  "190": 2024, // 令和6年
  "200": 2025, // 令和7年
};
