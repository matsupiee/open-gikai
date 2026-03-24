/**
 * 南伊豆町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.minamiizu.shizuoka.jp/category/bunya/tyougikai/gijiroku/
 * PDF ベースの議事録公開。3つの期間別一覧ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.town.minamiizu.shizuoka.jp";

/** 一覧ページ URL（固定） */
export const LIST_URLS = [
  `${BASE_ORIGIN}/docs/2022012000012/`, // 令和元年～
  `${BASE_ORIGIN}/docs/2021122800062/`, // 平成21年～31年
  `${BASE_ORIGIN}/docs/2021122800055/`, // 平成11年～20年
];

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(
  section: string
): "plenary" | "extraordinary" | "committee" {
  if (section.includes("委員会")) return "committee";
  if (section.includes("臨時")) return "extraordinary";
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
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 和暦の年月から西暦年に変換する。
 * 令和元年 → 2019, 令和7年 → 2025
 * 平成31年 → 2019, 平成元年 → 1989
 */
export function toWesternYear(era: string, eraYearRaw: string): number | null {
  const eraYear = eraYearRaw === "元" ? 1 : Number(eraYearRaw);
  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}
