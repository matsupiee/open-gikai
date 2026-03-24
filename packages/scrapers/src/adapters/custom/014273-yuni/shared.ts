/**
 * 由仁町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.yuni.lg.jp/chosei/gikai/teireikai
 * 自治体コード: 014273
 *
 * 文字コード: UTF-8
 * 特記: 会議録はすべて PDF 形式で公開
 */

export const BASE_ORIGIN = "https://www.town.yuni.lg.jp";

/** 定例会一覧ページ URL */
export const TEIREIKAI_URL = `${BASE_ORIGIN}/chosei/gikai/teireikai`;

/** 臨時会一覧ページ URL */
export const RINJIKAI_URL = `${BASE_ORIGIN}/chosei/gikai/rinjikai`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
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

/** fetch してバイナリを返す（PDF ダウンロード用） */
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

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 全角数字・全角記号を半角に変換する。
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 年号文字列と年数字から西暦に変換する。
 * 「元」は 1 年として扱う。
 */
export function eraToWestern(era: string, yearStr: string): number | null {
  const n = yearStr === "元" ? 1 : parseInt(yearStr, 10);
  if (isNaN(n)) return null;
  if (era === "令和") return 2018 + n;
  if (era === "平成") return 1988 + n;
  return null;
}

/**
 * 「令和７年３月４日」のような日付文字列を YYYY-MM-DD に変換する。
 * 解析できない場合は null を返す。
 */
export function parseDateString(text: string): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const year = eraToWestern(match[1]!, match[2]!);
  if (!year) return null;

  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
