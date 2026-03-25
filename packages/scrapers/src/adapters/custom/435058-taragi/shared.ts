/**
 * 多良木町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.taragi.lg.jp/
 *
 * 多良木町は町公式サイトで PDF を直接公開している。
 * 会議録一覧ページ → 各詳細ページ → PDF という 2 段階構造。
 */

export const BASE_ORIGIN = "https://www.town.taragi.lg.jp";

export const LIST_URL =
  "https://www.town.taragi.lg.jp/gyousei/soshiki/gikai/gikaikaigiroku/index.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): "plenary" | "committee" | "extraordinary" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
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

/** fetch して ArrayBuffer を返す（PDF 用） */
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

/**
 * 詳細ページの externalId 用キーを生成する。
 * e.g., "3720" → "taragi_3720"
 */
export function buildExternalId(detailId: string): string {
  return `taragi_${detailId}`;
}

/**
 * 詳細ページの URL から ID を抽出する。
 * e.g., "https://www.town.taragi.lg.jp/gyousei/soshiki/gikai/gikaikaigiroku/3720.html" → "3720"
 */
export function extractDetailId(url: string): string | null {
  const match = url.match(/\/gikaikaigiroku\/(\d+)\.html/);
  return match?.[1] ?? null;
}

/**
 * リンクテキストから会議開催年（西暦）を抽出する。
 * e.g., "令和6年度第5回多良木町議会（12月定例会議）" → 2024
 * e.g., "令和元年度第1回多良木町議会（5月会議）" → 2019
 * e.g., "平成29年度第3回多良木町議会（9月定例会議）" → 2017
 *
 * 年度ではなく開催月の西暦を返す。
 * 年度は4月始まりのため、1〜3月は翌年に対応する。
 * e.g., 令和6年度12月 → 2024年12月 (令和6年 + 2018 = 2024)
 *       令和6年度3月 → 2025年3月 (令和6年 + 1 + 2018 = 2025)
 */
export function extractYearFromTitle(title: string): number | null {
  const match = title.match(/(令和|平成)(元|\d+)年度.*?（(\d+)月/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);

  const fiscalStartYear = eraYear + (era === "平成" ? 1988 : 2018);

  // 1〜3月は年度の翌年
  return month <= 3 ? fiscalStartYear + 1 : fiscalStartYear;
}

/**
 * リンクテキストから開催月を抽出する。
 * e.g., "令和6年度第5回多良木町議会（12月定例会議）" → 12
 */
export function extractMonthFromTitle(title: string): number | null {
  const match = title.match(/（(\d+)月/);
  if (!match) return null;
  return parseInt(match[1]!, 10);
}

/**
 * 西暦年と開催月から YYYY-MM-01 形式の日付を生成する（日は不明なので 1 日とする）。
 */
export function buildHeldOnFromYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}
