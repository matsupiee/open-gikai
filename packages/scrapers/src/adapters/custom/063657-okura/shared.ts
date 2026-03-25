/**
 * 大蔵村議会 — 共通ユーティリティ
 *
 * サイト: https://www.vill.ohkura.yamagata.jp/gyoseijoho/okurasongikai/2301.html
 * PDF ベースの議事録公開。1ページに全年度の PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.vill.ohkura.yamagata.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 会議タイトルから会議タイプを検出する。
 *
 * - 臨時会 → extraordinary
 * - 委員会 → committee
 * - それ以外（定例会等） → plenary
 */
export function detectMeetingType(
  title: string
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
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
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 和暦数字（令和/平成）を西暦年に変換する。
 * e.g., "令和6" → 2024, "令和元" → 2019, "平成31" → 2019
 */
export function eraToWesternYear(
  era: "令和" | "平成",
  eraYearStr: string
): number {
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  if (era === "令和") return eraYear + 2018;
  return eraYear + 1988;
}

/**
 * PDF ファイル名（拡張子なし）から会議タイトルを生成する。
 * e.g., "R6teirei3gatsu" → "令和6年定例会3月"
 *       "R6rinji5gatsu" → "令和6年臨時会5月"
 *       "R7teirei3gatsu" → "令和7年定例会3月"
 */
export function buildTitleFromFilename(filenameNoExt: string): string | null {
  // パターン: R{年}{teirei|rinji}{月}gatsu
  const match = filenameNoExt.match(/^R(\d+)(teirei|rinji)(\d+)gatsu$/i);
  if (!match) return null;

  const reiwaYear = match[1]!;
  const kind = match[2]!.toLowerCase() === "teirei" ? "定例会" : "臨時会";
  const month = match[3]!;

  return `令和${reiwaYear}年${kind}${month}月`;
}

/**
 * PDF ファイル名（拡張子なし）から会議の西暦年と月を取得する。
 * e.g., "R6teirei3gatsu" → { year: 2024, month: 3 }
 *       "R7teirei3gatsu" → { year: 2025, month: 3 }
 */
export function parseDateFromFilename(
  filenameNoExt: string
): { year: number; month: number } | null {
  const match = filenameNoExt.match(/^R(\d+)(?:teirei|rinji)(\d+)gatsu$/i);
  if (!match) return null;

  const reiwaYear = parseInt(match[1]!, 10);
  const month = parseInt(match[2]!, 10);
  const year = reiwaYear + 2018;

  return { year, month };
}
