/**
 * 内子町議会（愛媛県）-- 共通ユーティリティ
 *
 * サイト: https://www.town.uchiko.ehime.jp/site/kaigiroku/
 * 自治体コード: 384224
 */

export const BASE_ORIGIN = "https://www.town.uchiko.ehime.jp";

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
    if (!res.ok) {
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
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
  } catch (e) {
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e
    );
    return null;
  }
}

/**
 * 和暦の年表記から西暦を返す。
 * 例:
 *   "令和7年" -> 2025
 *   "令和元年" -> 2019
 *   "平成31年" -> 2019
 *   "平成30年" -> 2018
 */
export function parseWarekiYear(text: string): number | null {
  // 「平成31年(令和元年)」パターン → 令和元年 = 2019
  if (/平成31年.*令和元年/.test(text)) return 2019;

  // 括弧内の西暦 「令和X（XXXX）年」または「平成X（XXXX）年」
  const withSeireki = text.match(/(?:令和|平成)(?:\d+|元)[（(](\d{4})[）)]年/);
  if (withSeireki?.[1]) {
    return parseInt(withSeireki[1], 10);
  }

  // 令和（括弧なし）
  const reiwa = text.match(/令和(\d+|元)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  // 平成（括弧なし）
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
