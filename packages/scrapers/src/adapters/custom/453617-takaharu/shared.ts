/**
 * 高原町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.takaharu.lg.jp/site/gikai/list18.html
 * バックナンバー: https://www.town.takaharu.lg.jp/site/gikai/296447.html
 * 自治体コード: 453617
 */

export const BASE_ORIGIN = "https://www.town.takaharu.lg.jp";
export const LIST_PAGE_URL =
  "https://www.town.takaharu.lg.jp/site/gikai/296447.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(
  meetingKind: string,
): "plenary" | "extraordinary" | "committee" {
  if (meetingKind.includes("臨時")) return "extraordinary";
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
      console.warn(
        `[453617-takaharu] fetchPage failed: ${url} status=${res.status}`,
      );
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[453617-takaharu] fetchPage error: ${url}`,
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
      console.warn(
        `[453617-takaharu] fetchBinary failed: ${url} status=${res.status}`,
      );
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[453617-takaharu] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 全角数字を半角数字に変換する。
 * e.g., "９月５日" → "9月5日"
 */
export function normalizeFullWidth(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * 和暦テキストを西暦年に変換する。
 * e.g., "令和6" → 2024, "令和元" → 2019, "平成30" → 2018
 */
export function eraToWesternYear(era: string, yearStr: string): number {
  const y = yearStr === "元" ? 1 : parseInt(normalizeFullWidth(yearStr), 10);
  if (era === "令和") return 2018 + y;
  if (era === "平成") return 1988 + y;
  return y;
}

/**
 * 西暦年から和暦タイトル文字列を生成する。
 * e.g., 2025 → "令和7年", 2019 → "令和元年", 2018 → "平成30年"
 */
export function buildEraTitle(year: number): string {
  if (year >= 2019) {
    const rYear = year - 2018;
    return rYear === 1 ? "令和元年" : `令和${rYear}年`;
  }
  if (year >= 1989) {
    const hYear = year - 1988;
    return hYear === 1 ? "平成元年" : `平成${hYear}年`;
  }
  return `${year}年`;
}
