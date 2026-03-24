/**
 * 大鰐町議会 — 共通ユーティリティ
 *
 * サイト: http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/
 * 自治体コード: 023621
 *
 * 町公式サイト内の静的 HTML ページに PDF ファイルを直接掲載している。
 * 年度別の HTML ページ（R{和暦年}teireikairinjikai.html）から
 * 「会議録」を含む PDF リンクを抽出してダウンロードする。
 */

export const BASE_URL =
  "http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 西暦年を令和年に変換する。
 * e.g., 2024 → 6, 2025 → 7
 */
export function toReiwaYear(year: number): number {
  return year - 2018;
}

/**
 * 令和年（数値）から年度別ページの URL を構築する。
 * e.g., toReiwaYear(2024) = 6 → "http://...R6teireikairinjikai.html"
 */
export function buildYearPageUrl(year: number): string {
  const reiwaYear = toReiwaYear(year);
  return `${BASE_URL}R${reiwaYear}teireikairinjikai.html`;
}

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

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
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

/**
 * 全角数字・全角「元」を半角に正規化する。
 * e.g., "１２" → "12", "元" → "1"
 */
function normalizeJapaneseNumber(s: string): number {
  if (s === "元") return 1;
  const normalized = s.replace(/[０-９]/g, (c) =>
    String("０１２３４５６７８９".indexOf(c)),
  );
  return parseInt(normalized, 10);
}

/**
 * h2 テキストから開催日 YYYY-MM-DD を解析する。
 *
 * 対応パターン:
 *   令和{N}年第{回}回定例会（令和{N}年{月}月）
 *   令和{N}年第{回}回臨時会（令和{N}年{月}月{日}日）
 *
 * 和暦「元」・全角数字（１２月 等）にも対応。
 */
export function parseDateFromH2(text: string): string | null {
  // 日付付きパターン（臨時会など）: 令和N年M月D日（半角・全角混在に対応）
  const withDayMatch = text.match(
    /(令和|平成)(元|[０-９\d]+)年([０-９\d]+)月([０-９\d]+)日/,
  );
  if (withDayMatch) {
    const eraYear = normalizeJapaneseNumber(withDayMatch[2]!);
    const westernYear =
      withDayMatch[1] === "令和" ? eraYear + 2018 : eraYear + 1988;
    const month = normalizeJapaneseNumber(withDayMatch[3]!);
    const day = normalizeJapaneseNumber(withDayMatch[4]!);
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 月のみパターン（定例会）: 令和N年M月（半角・全角混在に対応）
  const monthOnlyMatch = text.match(
    /(令和|平成)(元|[０-９\d]+)年([０-９\d]+)月/,
  );
  if (monthOnlyMatch) {
    const eraYear = normalizeJapaneseNumber(monthOnlyMatch[2]!);
    const westernYear =
      monthOnlyMatch[1] === "令和" ? eraYear + 2018 : eraYear + 1988;
    const month = normalizeJapaneseNumber(monthOnlyMatch[3]!);
    return `${westernYear}-${String(month).padStart(2, "0")}-01`;
  }

  return null;
}
