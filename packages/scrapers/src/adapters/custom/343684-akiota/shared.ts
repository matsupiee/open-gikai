/**
 * 安芸太田町議会 — 共通ユーティリティ
 *
 * サイト: https://www.akiota.jp/site/gikai/list26-80.html
 * 自治体コード: 343684
 */

export const BASE_ORIGIN = "https://www.akiota.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 年度別ページ URL マッピング。
 * 一覧ページ list26-80.html のリンクから取得した年度 → ページ ID の対応表。
 * 新年度が追加された場合は一覧ページから動的に取得する。
 */
export const YEAR_PAGE_MAP: Record<number, string> = {
  2026: "17653",
  2025: "14987",
  2024: "12064",
  2023: "8069",
  2022: "8068",
  2021: "1374",
  2020: "1372",
};

/** 会議タイプを検出 */
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
 * 和暦の年表記から西暦を返す。
 * 例: "令和7年" → 2025, "平成30年" → 2018
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

/** 年度別ページの URL を組み立てる */
export function buildYearPageUrl(pageId: string): string {
  return `${BASE_ORIGIN}/site/gikai/${pageId}.html`;
}

/** PDF の絶対 URL を組み立てる */
export function buildPdfUrl(path: string): string {
  if (path.startsWith("http")) return path;
  return `${BASE_ORIGIN}${path}`;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
