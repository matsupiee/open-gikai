/**
 * 八女市議会（福岡県） — 共通ユーティリティ
 *
 * サイト: https://www.city.yame.fukuoka.jp/shisei/12/7/index.html
 * 独自 CMS による HTML ページ公開。各会議ごとに個別ページが設けられ、
 * 会議録本文は PDF として提供される。
 */

export const BASE_ORIGIN = "https://www.city.yame.fukuoka.jp";
export const BASE_PATH = "/shisei/12/7";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("委員")) return "committee";
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
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
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

/**
 * 和暦テキストから YYYY-MM-DD を返す。
 * 「令和6年3月4日」→ "2024-03-04"
 * 「令和元年6月1日」→ "2019-06-01"
 * 「平成31年1月1日」→ "2019-01-01"
 */
export function parseDateText(text: string): string | null {
  const match = text.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 年号ディレクトリ名から西暦年に変換するマッピング。
 * 八女市は年号ディレクトリの命名規則が統一されていないため静的テーブルを使用。
 *
 * パターン:
 *   R8 → 2026 (令和8年)
 *   R7_1 → 2025 (令和7年)
 *   kako-kaigikekka/R6_1 → 2024 (令和6年)
 *   kako-kaigikekka/R5_1 → 2023 (令和5年)
 *   kako-kaigikekka/reiwa4 → 2022 (令和4年)
 *   kako-kaigikekka/reiwa3 → 2021 (令和3年)
 *   kako-kaigikekka/reiwa2 → 2020 (令和2年)
 *   kako-kaigikekka/H31 → 2019 (平成31年/令和元年)
 *   kako-kaigikekka/H30 → 2018 (平成30年)
 *   kako-kaigikekka/H29 → 2017 (平成29年)
 */
export function yearDirToWesternYear(dirName: string): number | null {
  // "kako-kaigikekka/R6_1" → "R6_1"
  const base = dirName.split("/").pop() ?? dirName;

  // R{n} or R{n}_{suffix} パターン
  const rMatch = base.match(/^R(\d+)(?:_\d+)?$/);
  if (rMatch) {
    const n = parseInt(rMatch[1]!, 10);
    return n + 2018; // 令和n年 = 2018+n
  }

  // reiwa{n} パターン
  const reiwaMatch = base.match(/^reiwa(\d+)$/);
  if (reiwaMatch) {
    const n = parseInt(reiwaMatch[1]!, 10);
    return n + 2018;
  }

  // H{n} パターン（平成）
  const hMatch = base.match(/^H(\d+)$/);
  if (hMatch) {
    const n = parseInt(hMatch[1]!, 10);
    return n + 1988;
  }

  return null;
}
