/**
 * 南越前町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.minamiechizen.lg.jp/tyougikai/kaigiroku/index.html
 * 自治体コード: 184047
 *
 * 会議録は年度別ページで一覧化され、各会議録は単一 PDF として提供される。
 * HTML 中間ページ経由で PDF にアクセス可能だが、URL パターンから直接構築できる。
 */

export const BASE_ORIGIN = "https://www.town.minamiechizen.lg.jp";
export const BASE_KAIGIROKU_PATH = "/tyougikai/kaigiroku";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 年度コード一覧。4月始まりの日本の年度区分に従う。
 * key: 年度コード, value: 年度開始の西暦年
 */
export const NENDO_CODE_MAP: Record<string, number> = {
  h30: 2018,
  r1: 2019,
  r2: 2020,
  r3: 2021,
  r4: 2022,
  r5: 2023,
  r6: 2024,
  r7: 2025,
};

/**
 * 西暦年から対象年度コードを求める。
 *
 * ある会議の開催年（例: 2024）が含まれる可能性がある年度は
 * 当該年度（2024年4月〜2025年3月 = r6）と
 * 前年度（2023年4月〜2024年3月 = r5）の2つ。
 * ただし year で filter するため両方を候補として返す。
 */
export function getNendoCodesForYear(year: number): string[] {
  return Object.entries(NENDO_CODE_MAP)
    .filter(([, startYear]) => startYear === year || startYear === year - 1)
    .map(([code]) => code);
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦タイトルから西暦年と月を抽出する。
 *
 * 対応パターン:
 *   令和6年12月定例会　会議録
 *   令和6年11月臨時会　会議録
 *   令和元年X月定例会　会議録
 *   平成30年X月定例会　会議録
 */
export function extractYearMonth(title: string): { year: number; month: number | null } {
  // 令和（元年対応）
  const reiwaMatch = title.match(/令和(元|\d+)年(\d+)月/);
  if (reiwaMatch) {
    const nengo = reiwaMatch[1] === "元" ? 1 : parseInt(reiwaMatch[1]!, 10);
    const year = 2018 + nengo;
    const month = parseInt(reiwaMatch[2]!, 10);
    return { year, month };
  }

  // 令和（月なし）
  const reiwaNoMonthMatch = title.match(/令和(元|\d+)年/);
  if (reiwaNoMonthMatch) {
    const nengo = reiwaNoMonthMatch[1] === "元" ? 1 : parseInt(reiwaNoMonthMatch[1]!, 10);
    const year = 2018 + nengo;
    return { year, month: null };
  }

  // 平成
  const heiseiMatch = title.match(/平成(\d+)年(\d+)月/);
  if (heiseiMatch) {
    const year = 1988 + parseInt(heiseiMatch[1]!, 10);
    const month = parseInt(heiseiMatch[2]!, 10);
    return { year, month };
  }

  // 平成（月なし）
  const heiseiNoMonthMatch = title.match(/平成(\d+)年/);
  if (heiseiNoMonthMatch) {
    const year = 1988 + parseInt(heiseiNoMonthMatch[1]!, 10);
    return { year, month: null };
  }

  return { year: 0, month: null };
}

/**
 * 年・月から YYYY-MM-01 形式の日付文字列を構築する。
 * 月が不明な場合は YYYY-01-01 を返す。
 * 年が 0 の場合は null を返す（解析失敗時）。
 */
export function buildHeldOn(year: number, month: number | null): string | null {
  if (!year) return null;
  const m = month ?? 1;
  return `${year}-${String(m).padStart(2, "0")}-01`;
}

/**
 * 年度コードから年度別一覧ページの URL を構築する。
 */
export function buildNendoIndexUrl(nendoCode: string): string {
  return `${BASE_ORIGIN}${BASE_KAIGIROKU_PATH}/${nendoCode}/index.html`;
}

/**
 * HTML 中間ページの ID から PDF URL を直接構築する。
 *
 * パターン: p{ID}.html → p{ID}_d/fil/gikai1.pdf
 */
export function buildPdfUrl(nendoCode: string, pageId: string): string {
  return `${BASE_ORIGIN}${BASE_KAIGIROKU_PATH}/${nendoCode}/${pageId}_d/fil/gikai1.pdf`;
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

/** バイナリデータを取得する */
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
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
