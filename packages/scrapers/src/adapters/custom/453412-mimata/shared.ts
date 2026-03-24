/**
 * 三股町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.mimata.lg.jp/categories/index/kaigiroku
 * 自治体コード: 453412
 */

export const BASE_ORIGIN = "https://www.town.mimata.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別記事ページ URL 一覧（ハードコード）
 * 年度は西暦で管理（令和6年度 = 2024 等）
 */
export const YEAR_CONTENT_URLS: ReadonlyArray<{
  year: number;
  contentPath: string;
}> = [
  { year: 2025, contentPath: "/contents/2219.html" },
  { year: 2024, contentPath: "/contents/1906.html" },
  { year: 2023, contentPath: "/contents/1688.html" },
  { year: 2022, contentPath: "/contents/1458.html" },
  { year: 2021, contentPath: "/contents/1219.html" },
  { year: 2020, contentPath: "/contents/1220.html" },
  { year: 2019, contentPath: "/contents/566.html" },
  { year: 2018, contentPath: "/contents/470.html" },
  { year: 2017, contentPath: "/contents/469.html" },
  { year: 2016, contentPath: "/contents/468.html" },
  { year: 2015, contentPath: "/contents/467.html" },
  { year: 2014, contentPath: "/contents/466.html" },
  { year: 2013, contentPath: "/contents/465.html" },
  { year: 2012, contentPath: "/contents/464.html" },
  { year: 2011, contentPath: "/contents/463.html" },
  { year: 2010, contentPath: "/contents/462.html" },
  { year: 2009, contentPath: "/contents/461.html" },
  { year: 2008, contentPath: "/contents/460.html" },
];

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[453412-mimata] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[453412-mimata] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/** 会議タイプを検出 */
export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6年" → 2024, "平成30年" → 2018, "令和元年" → 2019
 */
export function parseWarekiYear(text: string): number | null {
  const reiwa = text.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = text.match(/平成(元|\d+)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/**
 * PDF ファイル名（URLデコード済み）から開催月を抽出し、
 * YYYY-MM-DD 形式の文字列を返す。
 * 例: "令和7年9月定例会.pdf" → "2025-09-01"
 * heldOn が解析できない場合は null を返す。
 */
export function parsePdfFilenameToDate(filename: string): string | null {
  // ファイル名から年月を抽出
  const m = filename.match(/^(令和|平成)(元|\d+)年(\d{1,2})月/);
  if (!m) return null;

  const era = m[1]!;
  const yearStr = m[2]!;
  const month = parseInt(m[3]!, 10);

  const eraYear = yearStr === "元" ? 1 : parseInt(yearStr, 10);
  const westernYear = era === "令和" ? 2018 + eraYear : 1988 + eraYear;

  return `${westernYear}-${String(month).padStart(2, "0")}-01`;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
