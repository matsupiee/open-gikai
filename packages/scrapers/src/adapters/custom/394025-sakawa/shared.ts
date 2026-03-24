/**
 * 佐川町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.sakawa.lg.jp/
 * PDF ベースの議会情報公開（2段階クロールで年度別ページから PDF リンクを収集）。
 */

export const BASE_ORIGIN = "https://www.town.sakawa.lg.jp";
export const LIST_URL = `${BASE_ORIGIN}/life/dtl.php?hdnKey=1076`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

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
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e
    );
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
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 和暦テキストから西暦年に変換する。
 * 元年対応あり。
 *
 * e.g., "令和", "1" → 2019
 *       "令和", "元" → 2019
 *       "平成", "元" → 1989
 */
export function eraToWesternYear(era: string, eraYearStr: string): number | null {
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  if (isNaN(eraYear)) return null;

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * 佐川町サイトの和暦略式（例: `R7.3.7`、`H30.9.10`）を
 * 西暦 YYYY-MM-DD 文字列に変換する。
 *
 * 対応形式:
 *   R{年}.{月}.{日}  → 令和
 *   H{年}.{月}.{日}  → 平成
 *
 * 解析できない場合は null を返す。
 */
export function parseShortEraDate(text: string): string | null {
  const match = text.match(/([RH])(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;

  const [, eraChar, eraYearStr, monthStr, dayStr] = match;
  const eraYear = parseInt(eraYearStr!, 10);
  if (isNaN(eraYear)) return null;

  let westernYear: number;
  if (eraChar === "R") {
    westernYear = eraYear + 2018;
  } else if (eraChar === "H") {
    westernYear = eraYear + 1988;
  } else {
    return null;
  }

  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);
  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 全角数字を半角数字に変換する */
export function normalizeDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30));
}
