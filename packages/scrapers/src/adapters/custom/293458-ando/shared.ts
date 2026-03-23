/**
 * 安堵町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.ando.nara.jp/category/10-6-3-0-0-0-0-0-0-0.html
 * 自治体コード: 293458
 */

export const BASE_ORIGIN = "https://www.town.ando.nara.jp";

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

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和7年" → 2025, "令和元年" → 2019, "平成31年" → 2019
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
 * 和暦の年度ラベルから西暦年度を返す。
 * 例: "令和6年第1回定例会" → 2024
 *      "平成31年・令和元年" → 2019
 */
export function parseWarekiNendo(text: string): number | null {
  // "令和元年" or "令和N年"
  const reiwa = text.match(/令和(\d+|元)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  // "平成N年"
  const heisei = text.match(/平成(\d+|元)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/**
 * 年度の西暦から和暦テキストパターンを返す（年度ページ URL 特定用）。
 * 年度ページのタイトルには「令和6年」「平成31年・令和元年」などが含まれる。
 */
export function nendoToWarekiLabel(year: number): string[] {
  if (year >= 2019) {
    const reiwaYear = year - 2018;
    if (reiwaYear === 1) {
      // 令和元年 = 平成31年
      return ["令和元年", "平成31年"];
    }
    return [`令和${reiwaYear}年`];
  }
  if (year >= 1989) {
    const heiseiYear = year - 1988;
    if (heiseiYear === 1) {
      return ["平成元年"];
    }
    return [`平成${heiseiYear}年`];
  }
  return [];
}

/** fetch してバイナリ（ArrayBuffer）を返す */
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

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
