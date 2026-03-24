/**
 * 玖珠町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.kusu.oita.jp/choseijoho/kusuchogikai/1/index.html
 * 自治体コード: 444626
 */

export const BASE_ORIGIN = "https://www.town.kusu.oita.jp";

/** 会議録トップページ（年度一覧） */
export const INDEX_URL = `${BASE_ORIGIN}/choseijoho/kusuchogikai/1/index.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 年度 → 年度別一覧ページ ID のマッピング（ハードコード）。
 * 西暦年で管理。令和6年（2024年）= 5321 等。
 * SMART CMS が自動採番するため、連番でないページ ID を明示的に列挙する。
 */
export const YEAR_PAGE_IDS: ReadonlyArray<{ year: number; pageId: number }> = [
  { year: 2025, pageId: 5988 },
  { year: 2024, pageId: 5321 },
  { year: 2023, pageId: 4903 },
  { year: 2022, pageId: 4531 },
  { year: 2021, pageId: 3188 },
  { year: 2020, pageId: 3199 },
  // 平成31年（令和元年）= 2019
  { year: 2019, pageId: 3200 },
  { year: 2018, pageId: 3201 },
  { year: 2017, pageId: 3202 },
  { year: 2016, pageId: 3203 },
  // 〜平成27年（2015年以前）
  { year: 2015, pageId: 3204 },
];

/** fetch して UTF-8 テキストを返す。失敗時は null を返す。 */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[444626-kusu] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す。失敗時は null を返す。 */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[444626-kusu] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/**
 * 会議タイプを検出する。
 */
export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会") || title.includes("協議会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦年表記から西暦を返す。
 * 例: "令和6" → 2024, "平成31" → 2019, "令和元" → 2019
 * 変換できない場合は null を返す。
 */
export function parseWarekiYear(era: string, yearStr: string): number | null {
  const n = yearStr === "元" ? 1 : parseInt(yearStr, 10);
  if (isNaN(n)) return null;
  if (era === "令和") return 2018 + n;
  if (era === "平成") return 1988 + n;
  if (era === "昭和") return 1925 + n;
  return null;
}

/**
 * 年度別一覧ページの URL を組み立てる。
 */
export function buildYearPageUrl(pageId: number): string {
  return `${BASE_ORIGIN}/choseijoho/kusuchogikai/1/${pageId}.html`;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
