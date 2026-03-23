/**
 * 厚岸町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.akkeshi-town.jp/chogikai/minutes/
 *
 * 厚岸町は年度別ディレクトリ形式で PDF 会議録を公開している。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

export const BASE_ORIGIN = "https://www.akkeshi-town.jp";
export const MINUTES_PATH = "/chogikai/minutes";

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
  } catch {
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
  } catch {
    return null;
  }
}

/**
 * 西暦年から年度別ページの URL パスコードを返す。
 * e.g., 2024 → "r6", 2019 → "r1", 2018 → "h30"
 *
 * 平成10〜13年は "h10_13" という特殊ページにまとめられているが、
 * fetchList では year 単位で呼ばれるため個別に対応する。
 */
export function yearToEraCode(year: number): string | null {
  if (year >= 2019) {
    const eraYear = year - 2018;
    return `r${eraYear}`;
  }
  if (year >= 2002 && year <= 2018) {
    const eraYear = year - 1988;
    return `h${eraYear}`;
  }
  if (year >= 1998 && year <= 2001) {
    return "h10_13";
  }
  return null;
}

/**
 * 年度別ページの URL を組み立てる。
 */
export function buildYearPageUrl(year: number): string | null {
  const code = yearToEraCode(year);
  if (!code) return null;
  return `${BASE_ORIGIN}${MINUTES_PATH}/${code}/`;
}

/**
 * PDF ファイル名から externalId 用のキーを抽出する。
 * e.g., "/file/contents/3869/44926/r060126-rinjihonnkaigi.pdf" → "r060126-rinjihonnkaigi"
 */
export function extractExternalIdKey(pdfPath: string): string | null {
  const match = pdfPath.match(/([^/]+)\.pdf$/i);
  if (!match?.[1]) return null;
  return match[1];
}
