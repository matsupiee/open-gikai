/**
 * 綾川町議会 — 共通ユーティリティ
 *
 * サイト: https://ayagawa-gikai.jp/
 * 議会専用サイトで PDF ベースの議事録を公開。
 * teireikai.html に全年度の会議一覧がまとめられている。
 */

export const BASE_ORIGIN = "https://ayagawa-gikai.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
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
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    console.warn(
      `[373877-ayagawa] fetch 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
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
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `[373877-ayagawa] fetchBinary 失敗: ${url}`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

/**
 * 会議ページのタイトルテキストから開催年月を推定して YYYY-MM を返す。
 * テキストから直接日付は取れないため、会議名の月情報と年度から推定する。
 *
 * 綾川町の年度: 4月〜翌年3月
 * - 3月定例会 → 翌年3月（年度末）
 * - 5月臨時会 → 当年5月
 * - 6月定例会 → 当年6月
 * - 8月臨時会 → 当年8月
 * - 9月定例会 → 当年9月
 * - 10月臨時会 → 当年10月
 * - 11月臨時会 → 当年11月
 * - 12月定例会 → 当年12月
 */
export function estimateHeldOn(
  meetingText: string,
  fiscalYear: number
): string | null {
  const monthMatch = meetingText.match(/(\d{1,2})月/);
  if (!monthMatch) return null;
  const month = parseInt(monthMatch[1]!, 10);

  // 1〜3月は翌年（年度末）
  const calendarYear = month <= 3 ? fiscalYear + 1 : fiscalYear;
  return `${calendarYear}-${String(month).padStart(2, "0")}-01`;
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "img/202509kaigiroku.pdf" → "202509kaigiroku"
 * e.g., "img/file36.pdf" → "file36"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}
