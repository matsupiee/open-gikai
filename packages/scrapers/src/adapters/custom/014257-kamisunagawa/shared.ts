/**
 * 上砂川町議会 -- 共通ユーティリティ
 *
 * サイト: https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/index.html
 * 自治体コード: 014257
 */

export const BASE_ORIGIN = "https://town.kamisunagawa.hokkaido.jp";

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
 * 和暦の年度コードから西暦を返す。
 * 例: "r6" -> 2024, "r1" -> 2019, "h30" -> 2018, "h19" -> 2007
 */
export function parseNendoCode(code: string): number | null {
  const rMatch = code.match(/^r(\d+)$/);
  if (rMatch?.[1]) {
    return 2018 + parseInt(rMatch[1], 10);
  }

  const hMatch = code.match(/^h(\d+)$/);
  if (hMatch?.[1]) {
    return 1988 + parseInt(hMatch[1], 10);
  }

  return null;
}

/**
 * 西暦から年度コード文字列の配列を返す。
 * 令和元年（2019）以降は "r" プレフィックス、
 * それ以前は "h" プレフィックス。
 * 対象範囲: 平成19年（h19, 2007年）〜 現在
 *
 * 1つの西暦年が複数の年度コードに対応する場合がある
 * （例: 平成31年/令和元年は h31 として管理）。
 */
export function yearToNendoCodes(year: number): string[] {
  const codes: string[] = [];

  if (year >= 2019) {
    // 令和
    const r = year - 2018;
    codes.push(`r${r}`);
  }

  if (year <= 2019 && year >= 2007) {
    // 平成
    const h = year - 1988;
    codes.push(`h${h}`);
  }

  return codes;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
