/**
 * 中野区議会 議事録検索システム — 共通ユーティリティ
 *
 * サイト: https://kugikai-nakano.jp/
 * エンコーディング: UTF-8
 */

export const BASE_ORIGIN = "https://kugikai-nakano.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * ページを取得して UTF-8 文字列として返す。
 * HTTPS で失敗した場合は HTTP にフォールバック。
 */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    // HTTPS → HTTP フォールバック
    if (url.startsWith("https://")) {
      try {
        const httpUrl = url.replace(/^https:\/\//, "http://");
        const res = await fetch(httpUrl, {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        });
        if (!res.ok) return null;
        return await res.text();
      } catch {
        // HTTP でも失敗
      }
    }
    return null;
  }
}

/**
 * 検索ページの URL を組み立てる。
 */
export function buildListUrl(year: number, page = 1): string {
  return `${BASE_ORIGIN}/search.html?s1=${year}&s2=&flg=check&page=${page}`;
}

/**
 * 議事録詳細ページの URL を組み立てる。
 */
export function buildDetailUrl(gijirokuId: string): string {
  return `${BASE_ORIGIN}/view.html?gijiroku_id=${gijirokuId}`;
}

/**
 * 和暦日付（例: "令和7年12月10日", "令和７年１２月１０日"）を YYYY-MM-DD に変換する。
 */
export function parseJapaneseDate(text: string): string | null {
  const m = text.match(
    /(令和|平成|昭和)\s*([0-9０-９]+)\s*年\s*([0-9０-９]+)\s*月\s*([0-9０-９]+)\s*日/
  );
  if (!m) return null;

  const era = m[1]!;
  const eraYear = toHalfWidth(m[2]!);
  const month = toHalfWidth(m[3]!);
  const day = toHalfWidth(m[4]!);

  const gregorianYear = eraToGregorian(era, Number.parseInt(eraYear, 10));
  if (!gregorianYear) return null;

  return `${gregorianYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function eraToGregorian(era: string, year: number): number | null {
  switch (era) {
    case "令和":
      return 2018 + year;
    case "平成":
      return 1988 + year;
    case "昭和":
      return 1925 + year;
    default:
      return null;
  }
}

function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
}
