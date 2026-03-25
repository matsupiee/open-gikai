/**
 * 坂城町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.sakaki.nagano.jp/site/gikai/
 * 自治体コード: 205214
 */

export const BASE_ORIGIN = "https://www.town.sakaki.nagano.jp";

/** 会議録一覧ページの URL */
export const LIST_PAGE_URL =
  "https://www.town.sakaki.nagano.jp/site/gikai/list10.html";

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
 * 全角数字を半角数字に変換する。
 * 例: "８" → "8", "２５" → "25"
 */
export function toHankaku(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30)
  );
}

/**
 * 和暦（令和・平成）の年表記から西暦を返す。
 * 例: "令和６年" → 2024, "令和元年" → 2019, "平成２５年" → 2013
 */
export function parseWarekiYear(text: string): number | null {
  const normalized = toHankaku(text);

  const reiwa = normalized.match(/令和(\d+|元)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = normalized.match(/平成(\d+|元)年/);
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
