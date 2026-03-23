/**
 * 阿波市議会 -- 共通ユーティリティ
 *
 * サイト: https://www.city.awa.lg.jp/gikai/category/bunya/kaigiroku
 * 自治体コード: 362069
 */

export const BASE_ORIGIN = "https://www.city.awa.lg.jp";

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
    if (!res.ok) return null;
    return await res.text();
  } catch {
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
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
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

/**
 * 和暦の年を西暦の年度（nendo）に変換する。
 * 「令和7年第4回定例会」→ 年度は和暦年から判定。
 * 定例会は第1回が通常 3月、第4回が通常 12月なので、
 * 年度判定は和暦の年をそのまま使う。
 */
export function warekiToNendo(warekiYear: number, eraBase: number): number {
  return eraBase + warekiYear;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
