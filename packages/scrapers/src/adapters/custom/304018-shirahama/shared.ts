/**
 * 白浜町議会（和歌山県） — 共通ユーティリティ
 *
 * サイト: https://www.town.shirahama.wakayama.jp/soshiki/gikai/gyomu/kaigiroku/index.html
 * 自治体コード: 304018
 *
 * Joruri CMS 系の独自 CMS を使用。「最新の会議録」と「過去の会議録」の 2 セクション構成。
 */

export const BASE_ORIGIN = "https://www.town.shirahama.wakayama.jp";

/** 過去の会議録 年度インデックスページ */
export const KAKO_INDEX_URL = `${BASE_ORIGIN}/soshiki/gikai/gyomu/kaigiroku/kako/index.html`;

/** 最新の会議録 トップページ */
export const SAISHIN_TOP_URL = `${BASE_ORIGIN}/soshiki/gikai/gyomu/kaigiroku/index.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 35_000;

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
    console.warn(`[304018-shirahama] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリを返す */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[304018-shirahama] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/** 会議タイプを検出する */
export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6年" → 2024, "平成30年" → 2018, "令和元年" → 2019
 */
export function parseWarekiYear(text: string): number | null {
  const reiwa = text.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = text.match(/平成(元|\d+)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
