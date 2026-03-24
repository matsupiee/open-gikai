/**
 * 長井市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.nagai.yamagata.jp/shigikai/kaigiroku/index.html
 *
 * 長井市は PDF ベースで議事録を公開している。
 * 3階層構造（トップ → 年度 → 会期別）から PDF を収集する。
 */

export const BASE_ORIGIN = "https://www.city.nagai.yamagata.jp";
export const INDEX_PATH = "/shigikai/kaigiroku/index.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

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
  } catch (err) {
    console.warn(
      `[062090-nagai] ページ取得失敗: ${url}`,
      err instanceof Error ? err.message : err,
    );
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
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[062090-nagai] PDF 取得失敗: ${url}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 長井市 PDF ファイル名（和暦）から西暦の開催日を返す。
 *
 * ファイル名パターン:
 *   nagaigikai_{和暦コード}_{月2桁}_{日2桁}[_{種別}].pdf
 *   例: nagaigikai_R7_01_24.pdf → 2025-01-24
 *       nagaigikai_R7_03_04_kaigi.pdf → 2025-03-04
 *       nagaigikai_yosan_R7_03_13_kaigi.pdf → 2025-03-13
 *
 * 和暦コード: R{年} = 令和、H{年} = 平成
 */
export function parseDateFromFilename(filename: string): string | null {
  // nagaigikai_[prefix_]R7_01_24[_suffix].pdf
  const match = filename.match(
    /nagaigikai_(?:[a-zA-Z]+_)?([RH])(\d+)_(\d{2})_(\d{2})(?:_[a-zA-Z]+)?\.pdf$/i,
  );
  if (!match) return null;

  const [, eraChar, eraYearStr, monthStr, dayStr] = match;
  const eraYear = parseInt(eraYearStr!, 10);
  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  let westernYear: number;
  if (eraChar!.toUpperCase() === "R") {
    westernYear = eraYear + 2018;
  } else {
    westernYear = eraYear + 1988;
  }

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 和暦テキスト（令和/平成 + 年）から西暦年を返す。
 * e.g., "令和7年" → 2025
 *       "平成16年" → 2004
 *       "令和元年" → 2019
 */
export function parseEraYear(text: string): number | null {
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, eraYearStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}
