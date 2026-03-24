/**
 * 美浜町議会（和歌山県） — 共通ユーティリティ
 *
 * サイト: http://www.town.mihama.wakayama.jp/bunya/gikai_kaigiroku/
 * 自治体コード: 303810
 *
 * Joruri CMS を使用。HTTP のみ（HTTPS 非対応）。
 */

export const BASE_ORIGIN = "http://www.town.mihama.wakayama.jp";

/** 会議録トップページ */
export const TOP_URL = `${BASE_ORIGIN}/bunya/gikai_kaigiroku/`;

/** 記事一覧ページ（古い年度を含む） */
export const GIKAI_LIST_URL = `${BASE_ORIGIN}/bunya/gikai_kaigiroku/gikai/`;

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
    console.warn(`[303810-mihama-wakayama] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリを返す */
export async function fetchBinary(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch (e) {
    console.warn(`[303810-mihama-wakayama] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/** 会議タイプを検出する */
export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和6年" → 2024, "平成30年" → 2018, "令和元年" → 2019
 */
export function parseWarekiYear(text: string): number | null {
  const reiwa = text.match(/令和(\d+|元)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = text.match(/平成(\d+|元)年/);
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
