/**
 * 嬉野市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.ureshino.lg.jp/gikai/hokoku/394.html
 * 自治体コード: 412091
 */

export const BASE_ORIGIN = "https://www.city.ureshino.lg.jp";

/** 会議録トップページ（年度一覧） */
export const TOP_PAGE_PATH = "/gikai/hokoku/394.html";

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
      console.warn(`[ureshino] fetchPage: HTTP ${res.status} for ${url}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`[ureshino] fetchPage: failed to fetch ${url}:`, err);
    return null;
  }
}

/**
 * 年号テキストから西暦を返す。
 *
 * 対応パターン:
 *   - "令和7年" → 2025
 *   - "令和7第1回定例会"（年なし） → 2025
 *   - "令和元年" → 2019
 *   - "令和元年・平成31年" → 2019
 *   - "平成30年" → 2018
 *
 * 解析できない場合は null を返す。
 */
export function parseEraYear(label: string): number | null {
  // 令和元年
  if (label.includes("令和元年")) return 2019;

  // 令和N年 または 令和N（年号なし、"令和7第1回..."のような表記）
  const reiwa = label.match(/令和(\d+)/);
  if (reiwa) {
    const n = parseInt(reiwa[1]!, 10);
    return 2018 + n;
  }

  // 平成N年
  const heisei = label.match(/平成(\d+)年/);
  if (heisei) {
    const n = parseInt(heisei[1]!, 10);
    return 1988 + n;
  }

  return null;
}

/**
 * セッションタイトル（例: "令和7年第1回定例会"）から開催年を推定する。
 * タイトルに年号が含まれる場合はそこから取得し、含まれない場合は null を返す。
 */
export function parseYearFromSessionTitle(title: string): number | null {
  return parseEraYear(title);
}

/**
 * 月日文字列（"3月21日"）と年から YYYY-MM-DD を生成する。
 * 月が 1 桁の場合は 0 埋めする。
 */
export function buildDateStr(year: number, monthDay: string): string | null {
  const m = monthDay.match(/(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const month = String(parseInt(m[1]!, 10)).padStart(2, "0");
  const day = String(parseInt(m[2]!, 10)).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
