/**
 * 品川区議会 会議録検索システム — 共通ユーティリティ
 *
 * サイト: https://kaigiroku.city.shinagawa.tokyo.jp/
 */

export const BASE_ORIGIN = "https://kaigiroku.city.shinagawa.tokyo.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * 品川区会議録の一覧ページで使う Cabinet ID。
 * Cabinet=1: 定例会、Cabinet=2: 臨時会、Cabinet=3〜: 各委員会
 */
export const CABINET_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22] as const;

/** 一覧ページの1ページあたりの件数 */
export const PAGE_SIZE = 10;

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

/**
 * 一覧ページの URL を組み立てる。
 */
export function buildListUrl(
  cabinetId: number,
  year: number,
  startRecord = 1,
): string {
  const params = new URLSearchParams({
    QueryType: "new",
    Template: "list",
    Cabinet: String(cabinetId),
    TermStart: `${year}-01-01`,
    TermEnd: `${year}-12-31`,
    StartRecord: String(startRecord),
  });
  return `${BASE_ORIGIN}/index.php/100000?${params.toString()}`;
}

/**
 * ドキュメントページの URL を組み立てる。
 */
export function buildDocumentUrl(documentId: string): string {
  return `${BASE_ORIGIN}/index.php/100000?Template=document&Id=${documentId}&maxResultCount=200`;
}
