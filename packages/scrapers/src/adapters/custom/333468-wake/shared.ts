/**
 * 和気町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.town.wake.lg.jp/
 * 自治体コード: 333468
 */

export const BASE_URL = "https://www.town.wake.lg.jp";

/** 会議録一覧ページ（全年度分が1ページにまとまっている） */
export const LIST_PAGE_URL = `${BASE_URL}/soshiki/gikai/gyomu/1/378.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 会議タイプを検出する。
 * - 臨時会 → extraordinary
 * - 委員会 → committee
 * - 定例会 → plenary
 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
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
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す */
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
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 全角数字を半角に変換する。
 */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/**
 * PDF テキストから開催日（YYYY-MM-DD）を抽出する。
 * パターン: 「令和X年X月X日」（全角数字対応）
 */
export function extractHeldOnFromText(text: string): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  const baseYear = era === "令和" ? 2018 : 1988;
  const westernYear = baseYear + eraYear;
  const month = Number(match[3]);
  const day = Number(match[4]);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 和暦の年見出しから西暦年を返す。
 * 「令和6年」→ 2024, 「令和7年」→ 2025
 * 全角数字にも対応する。
 */
export function convertHeadingToWesternYear(text: string): number | null {
  const normalized = toHalfWidth(text);

  // 令和
  const reiwaMatch = normalized.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : Number(reiwaMatch[1]);
    return 2018 + eraYear;
  }

  // 平成
  const heiseiMatch = normalized.match(/平成(元|\d+)年/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : Number(heiseiMatch[1]);
    return 1988 + eraYear;
  }

  return null;
}
