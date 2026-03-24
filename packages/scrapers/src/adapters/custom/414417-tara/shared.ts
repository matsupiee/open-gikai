/**
 * 太良町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.tara.lg.jp/chosei/_1010/_1414.html
 * 自治体コード: 414417
 */

export const BASE_ORIGIN = "https://www.town.tara.lg.jp";

/** 会議録トップページ */
export const TOP_PAGE_PATH = "/chosei/_1010/_1414.html";

/** 決算審査特別委員会専用ページ */
export const KESSANKAISHU_PAGE_PATH = "/chosei/_1010/_1414/_1454.html";

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
      console.warn(`[tara] fetchPage: HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[tara] fetchPage: failed to fetch ${url}:`, err);
    return null;
  }
}

/**
 * 和暦年ラベルを西暦に変換する。
 *
 * 対応パターン:
 *   - "令和7年" → 2025
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
 * 和暦月日・年情報から YYYY-MM-DD を生成する。
 *
 * @param year 西暦年
 * @param month 月 (1-12)
 * @param day 日 (1-31)
 */
export function buildHeldOn(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
