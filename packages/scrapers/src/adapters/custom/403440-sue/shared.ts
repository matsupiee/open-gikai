/**
 * 須恵町議会（福岡県） — 共通ユーティリティ
 *
 * サイト: https://www.town.sue.fukuoka.jp/gyosei/gikai/1/index.html
 * 独自 CMS による HTML ページ公開。年度ごとに個別の HTML ページが設けられており、
 * 各ページから PDF 形式の会議録にリンクされている。
 */

export const BASE_ORIGIN = "https://www.town.sue.fukuoka.jp";

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
 * リンクテキストから月日を抽出して西暦年と組み合わせる。
 * 例: "3月3日（当初本会議）", year=2025 → "2025-03-03"
 * 例: "12月5日当初本会議", year=2024 → "2024-12-05"
 */
export function parseDateFromMonthDay(text: string, year: number): string | null {
  const match = text.match(/(\d+)月(\d+)日/);
  if (!match) return null;
  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** href を絶対 URL に変換する */
export function resolveUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return href;
}
