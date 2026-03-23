/**
 * 江差町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.hokkaido-esashi.jp/gikai/gikai.html
 * Shift_JIS エンコードの静的 HTML サイト。PDF 形式で会議録を公開。
 */

export const BASE_ORIGIN = "https://www.hokkaido-esashi.jp";

/** 本会議記録一覧ページ URL */
export const LIST_PAGE_URL = `${BASE_ORIGIN}/gikai/h24-honkaigi/honkaigi.html`;

/** 各会議詳細ページのベース URL */
export const DETAIL_BASE_URL = `${BASE_ORIGIN}/gikai/h24-honkaigi/`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(category: string): string {
  if (category.includes("委員会")) return "committee";
  if (category.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** 全角数字を半角数字に変換する */
export function normalizeNumbers(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦テキストから西暦年を返す。
 * 全角数字にも対応する。「元年」表記にも対応する。
 * e.g., "令和7年" -> 2025, "令和７年" -> 2025, "平成29年" -> 2017
 *       "令和元年" -> 2019, "平成元年" -> 1989
 */
export function eraToWesternYear(eraText: string): number | null {
  const normalized = normalizeNumbers(eraText);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, yearStr] = match;
  const eraYear = yearStr === "元" ? 1 : parseInt(yearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * href のディレクトリ名から西暦年を推定する。
 * e.g., "honkaigiR7/..." -> 2025, "honkaigi24/..." -> 2012
 */
export function yearFromDirName(dirName: string): number | null {
  // 令和パターン: honkaigiR7
  const reMatch = dirName.match(/^honkaigiR(\d+)$/);
  if (reMatch) {
    return parseInt(reMatch[1]!, 10) + 2018;
  }
  // 平成パターン: honkaigi31
  const heMatch = dirName.match(/^honkaigi(\d+)$/);
  if (heMatch) {
    return parseInt(heMatch[1]!, 10) + 1988;
  }
  return null;
}

/** fetch して Shift_JIS -> UTF-8 テキストを返す */
export async function fetchShiftJisPage(
  url: string,
): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchShiftJisPage failed: ${url} status=${res.status}`);
      return null;
    }
    const buf = await res.arrayBuffer();
    const decoder = new TextDecoder("shift_jis");
    return decoder.decode(buf);
  } catch (e) {
    console.warn(`fetchShiftJisPage error: ${url}`, e instanceof Error ? e.message : e);
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
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/gikai/h24-honkaigi/honkaigiR7/kaigiroku/250305teireikai/20250305teirei-total.pdf"
 *    -> "20250305teirei-total"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}
