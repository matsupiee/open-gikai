/**
 * 豊前市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.buzen.lg.jp/senkyo-gikai/gikai/gijiroku.html
 * PDF ベースの議事録公開。一覧ページに全年度のリンクが掲載され、
 * 各詳細ページに会議録 PDF へのリンクがある。
 */

export const BASE_ORIGIN = "https://www.city.buzen.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
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
    if (!res.ok) {
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(
      `fetchPage error: ${url}`,
      err instanceof Error ? err.message : err,
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
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      `fetchBinary error: ${url}`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * 西暦年から和暦のプレフィックスを生成する。
 * 一覧ページのリンクテキストに含まれる和暦テキストとマッチさせるために使用。
 * e.g., 2025 → ["令和7年"], 2019 → ["令和元年", "平成31年"]
 */
export function toJapaneseEraPrefix(year: number): string[] {
  const results: string[] = [];

  if (year >= 2020) {
    results.push(`令和${year - 2018}年`);
  } else if (year === 2019) {
    results.push("令和元年");
    results.push("平成31年");
  } else if (year >= 1989) {
    const eraYear = year - 1988;
    results.push(eraYear === 1 ? "平成元年" : `平成${eraYear}年`);
  }

  return results;
}

/**
 * 和暦テキストから西暦年を取得する。
 * e.g., "令和7年" → 2025, "平成22年" → 2010
 */
export function eraToWesternYear(text: string): number | null {
  const match = text.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, yearStr] = match;
  const eraYear = yearStr === "元" ? 1 : parseInt(yearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/**
 * PDF URL パスから externalId 用のキーを抽出する。
 * e.g., "/senkyo-gikai/gikai/documents/r7-2kaigiroku.pdf" → "r7-2kaigiroku"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/\/([^/]+)\.pdf$/i);
  if (!match) return null;
  return match[1]!;
}
