/**
 * 八幡浜市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.yawatahama.ehime.jp/gikai/
 * 自治体コード: 382043
 *
 * 会議録は HTML ページとして個別公開。ページネーションなし。
 * 本会議一覧ページ: /gikai/2022111000029/
 */

export const BASE_ORIGIN = "https://www.city.yawatahama.ehime.jp";

/** 本会議一覧ページの固定パス */
export const INDEX_PATH = "/gikai/2022111000029/";

/** 過去の本会議（平成17〜25年）の別ページ */
export const ARCHIVE_PATHS = [
  "/gikai/2016111600037/",
  "/gikai/2016111600044/",
  "/gikai/2016111600051/",
];

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦年を西暦年に変換する。
 * 元年は 1 として扱う。
 */
export function toSeireki(gengo: string, nenStr: string): number | null {
  const nen = nenStr === "元" ? 1 : parseInt(nenStr, 10);
  if (isNaN(nen)) return null;

  if (gengo === "令和") return 2018 + nen;
  if (gengo === "平成") return 1988 + nen;
  if (gengo === "昭和") return 1925 + nen;
  return null;
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
  } catch (e) {
    console.warn(`[yawatahama] fetchPage failed: ${url}`, e);
    return null;
  }
}
