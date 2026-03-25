/**
 * 多度津町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/index.html
 * 自治体コード: 374041
 */

export const BASE_ORIGIN = "https://www.town.tadotsu.kagawa.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  // http:// を https:// に統一
  const normalizedUrl = url.replace(/^http:\/\//, "https://");
  try {
    const res = await fetch(normalizedUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.warn(
      `[374041-tadotsu] fetch 失敗: ${normalizedUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  const normalizedUrl = url.replace(/^http:\/\//, "https://");
  try {
    const res = await fetch(normalizedUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[374041-tadotsu] fetchBinary 失敗: ${normalizedUrl}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/material/files/group/13/0712gianshingi.pdf" → "0712gianshingi"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}

/**
 * 和暦年を西暦年に変換する。
 * 令和 → +2018, 平成 → +1988, 昭和 → +1925
 */
export function eraToYear(eraName: string, eraYear: number | "元"): number {
  const year = eraYear === "元" ? 1 : eraYear;
  if (eraName === "令和") return year + 2018;
  if (eraName === "平成") return year + 1988;
  if (eraName === "昭和") return year + 1925;
  return year;
}
