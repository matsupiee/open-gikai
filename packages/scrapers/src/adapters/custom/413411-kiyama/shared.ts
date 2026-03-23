/**
 * 基山町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.kiyama.lg.jp/gikai/list01207.html
 * 自治体コード: 413411
 */

export const BASE_ORIGIN = "https://www.town.kiyama.lg.jp";

/** トップページ（会議録一覧） */
export const TOP_PAGE_PATH = "/gikai/list01207.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議種別を検出 */
export function detectMeetingType(title: string): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
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
      console.warn(`[kiyama] fetchPage: HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[kiyama] fetchPage: failed to fetch ${url}:`, err);
    return null;
  }
}

/** fetch してバイナリを返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[kiyama] fetchBinary: HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(`[kiyama] fetchBinary: failed to fetch ${url}:`, err);
    return null;
  }
}

/**
 * 和暦の年度テキストから西暦年を返す。
 *
 * 対応パターン:
 *   - "令和6年" → 2024
 *   - "令和元年" → 2019
 *   - "平成30年" → 2018
 *
 * 解析できない場合は null を返す。
 */
export function parseJapaneseYear(label: string): number | null {
  // 全角数字を半角に正規化
  const normalized = label.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );

  if (normalized.includes("令和元年")) return 2019;

  const reiwa = normalized.match(/令和(\d+)年/);
  if (reiwa) {
    const n = parseInt(reiwa[1]!, 10);
    return 2018 + n;
  }

  const heisei = normalized.match(/平成(\d+)年/);
  if (heisei) {
    const n = parseInt(heisei[1]!, 10);
    return 1988 + n;
  }

  return null;
}

/**
 * 「最終更新日：YYYY年M月D日」テキストから YYYY-MM-DD を返す。
 * 解析できない場合は null を返す（フォールバック値禁止）。
 */
export function parseUpdatedDate(text: string): string | null {
  const m = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const year = m[1]!;
  const month = m[2]!.padStart(2, "0");
  const day = m[3]!.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * 「XX月XX日」テキストから月と日を抽出する。
 * 解析できない場合は null を返す（フォールバック値禁止）。
 */
export function parseMonthDay(text: string): { month: number; day: number } | null {
  const m = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  return { month: parseInt(m[1]!, 10), day: parseInt(m[2]!, 10) };
}
