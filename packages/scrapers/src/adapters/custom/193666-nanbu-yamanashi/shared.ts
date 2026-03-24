/**
 * 山梨県南部町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.nanbu.yamanashi.jp/kakuka/gikai/kaigiroku.html
 * 自治体コード: 193666
 */

export const BASE_ORIGIN = "https://www.town.nanbu.yamanashi.jp";
export const LIST_PATH = "/kakuka/gikai/kaigiroku.html";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(label: string): string {
  if (label.includes("臨時会") || label.includes("臨時")) return "extraordinary";
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
 * 全角数字を半角数字に変換する。
 */
function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "令和7年" -> 2025, "令和元年" -> 2019, "平成23年" -> 2011
 * 全角数字（令和６年）も対応する。
 */
export function parseWarekiYear(text: string): number | null {
  const normalized = normalizeDigits(text);

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
