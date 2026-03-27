/**
 * 勝浦町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.town.katsuura.lg.jp/gikai/kaigiroku/
 * 自治体コード: 363014
 */

export const BASE_ORIGIN = "https://www.town.katsuura.lg.jp";
export const LIST_PAGE_URL = `${BASE_ORIGIN}/gikai/kaigiroku/`;

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
      console.warn(`[363014-katsuura] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (error) {
    console.warn(
      `[363014-katsuura] fetchPage error: ${url}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** fetch して PDF バイナリを返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[363014-katsuura] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (error) {
    console.warn(
      `[363014-katsuura] fetchBinary error: ${url}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** 全角数字を半角に変換する */
export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

/** 抽出テキストの空白を詰める */
export function collapseWhitespace(text: string): string {
  return toHalfWidth(text)
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/　+/g, " ")
    .trim();
}

/** 相対 URL を絶対 URL に変換する */
export function resolveUrl(href: string, baseUrl = LIST_PAGE_URL): string {
  return new URL(href, baseUrl).toString();
}

/**
 * 年度ラベルから fiscal year を西暦で返す。
 * 例:
 *   令和7年度 -> 2025
 *   平成31年度/令和元年度 -> 2019
 */
export function parseFiscalYearLabel(label: string): number | null {
  const normalized = toHalfWidth(label);

  const reiwaMatch = normalized.match(/令和(元|\d+)年度/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : Number(reiwaMatch[1]);
    return 2018 + eraYear;
  }

  const heiseiMatch = normalized.match(/平成(元|\d+)年度/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : Number(heiseiMatch[1]);
    return 1988 + eraYear;
  }

  return null;
}

/** 月から暦年を推定する。勝浦町は年度ページに4月〜翌3月を掲載する。 */
export function meetingCalendarYearFromFiscalYear(
  fiscalYear: number,
  month: number,
): number {
  return month >= 4 ? fiscalYear : fiscalYear + 1;
}

/** 会議タイトルから meetingType を推定する */
export function detectMeetingType(title: string): "plenary" | "committee" | "extraordinary" {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/** PDF URL から externalId 用のキーを取り出す */
export function extractExternalIdKey(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/([^/?#]+)\.pdf(?:[?#]|$)/i);
  return match ? match[1] ?? null : null;
}
