/**
 * 松前町議会（愛媛県）-- 共通ユーティリティ
 *
 * サイト: https://www.town.masaki.ehime.jp/site/gikai/list159.html
 * 自治体コード: 384011
 */

export const BASE_ORIGIN = "https://www.town.masaki.ehime.jp";

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
 *   "令和6（2024）年" -> 2024
 *   "令和元（2019）年" -> 2019
 *   "令和6年" -> 2024
 *   "平成30（2018）年" -> 2018
 *
 * 松前町サイトは「令和X（XXXX）年」形式で西暦が括弧内に含まれているため
 * 括弧内の西暦を優先して取得する。
 */
export function parseWarekiYear(text: string): number | null {
  // 「令和X（西暦）年」または「令和元（西暦）年」パターン（西暦が括弧内に明示）
  const reiwaWithSeireki = text.match(/令和(?:\d+|元)[（(](\d{4})[）)]年/);
  if (reiwaWithSeireki?.[1]) {
    return parseInt(reiwaWithSeireki[1], 10);
  }

  // 「平成X（西暦）年」パターン
  const heiseiWithSeireki = text.match(/平成(?:\d+|元)[（(](\d{4})[）)]年/);
  if (heiseiWithSeireki?.[1]) {
    return parseInt(heiseiWithSeireki[1], 10);
  }

  // 括弧なしフォールバック
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
