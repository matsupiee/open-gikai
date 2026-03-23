/**
 * 阿見町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.ami.lg.jp/0000000309.html
 * 自治体コード: 084433
 */

export const BASE_ORIGIN = "https://www.town.ami.lg.jp";
export const INDEX_PATH = "/0000000309.html";
export const PDF_DIR = "/cmsfiles/contents/0000000/309/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 会議タイプを検出する。
 * - 特別委員会 → committee
 * - 臨時会 → extraordinary
 * - 定例会 → plenary
 */
export function detectMeetingType(title: string): string {
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
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * リンクテキストから開催日の期間情報を抽出する。
 * 例: "第1回定例会（2月25日～3月18日）" → { startMonth: 2, startDay: 25, endMonth: 3, endDay: 18 }
 * 例: "第1回臨時会 （2月4日）" → { startMonth: 2, startDay: 4, endMonth: null, endDay: null }
 */
export function parseDateRange(text: string): {
  startMonth: number;
  startDay: number;
  endMonth: number | null;
  endDay: number | null;
} | null {
  // 期間パターン: N月N日～N月N日
  const rangeMatch = text.match(
    /(\d{1,2})月(\d{1,2})日[～〜~](\d{1,2})月(\d{1,2})日/
  );
  if (rangeMatch) {
    return {
      startMonth: parseInt(rangeMatch[1]!, 10),
      startDay: parseInt(rangeMatch[2]!, 10),
      endMonth: parseInt(rangeMatch[3]!, 10),
      endDay: parseInt(rangeMatch[4]!, 10),
    };
  }

  // 期間パターン（同月）: N月N日～N日
  const sameMonthRange = text.match(
    /(\d{1,2})月(\d{1,2})日[～〜~](\d{1,2})日/
  );
  if (sameMonthRange) {
    const month = parseInt(sameMonthRange[1]!, 10);
    return {
      startMonth: month,
      startDay: parseInt(sameMonthRange[2]!, 10),
      endMonth: month,
      endDay: parseInt(sameMonthRange[3]!, 10),
    };
  }

  // 単日パターン: N月N日
  const singleMatch = text.match(/(\d{1,2})月(\d{1,2})日/);
  if (singleMatch) {
    return {
      startMonth: parseInt(singleMatch[1]!, 10),
      startDay: parseInt(singleMatch[2]!, 10),
      endMonth: null,
      endDay: null,
    };
  }

  return null;
}

/**
 * 見出しテキストから西暦年を算出する。
 * - "令和7年" → 2025
 * - "令和元年" → 2019
 * - "平成31年" → 2019
 * - "平成18年" → 2006
 */
export function parseHeadingYear(text: string): number | null {
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
