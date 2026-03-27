/**
 * 朝日村議会 -- 共通ユーティリティ
 *
 * サイト: https://www.vill.asahi.nagano.jp/
 * 自治体コード: 204510
 */

export const BASE_ORIGIN = "https://www.vill.asahi.nagano.jp";

export const LIST_URL = `${BASE_ORIGIN}/official/soshikikarasagasu/gikaijimukyoku/giketsu_kaigiroku/1/index.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

/**
 * 全角数字を半角数字に変換する。
 * 例: "８" → "8", "２５" → "25"
 */
export function toHankaku(text: string): string {
  return text.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30));
}

/**
 * 和暦（令和・平成）の年表記から西暦を返す。
 * 例: "令和7年" → 2025, "平成元年" → 1989
 */
export function parseWarekiYear(text: string): number | null {
  const normalized = toHankaku(text);

  const reiwa = normalized.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const eraYear = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + eraYear;
  }

  const heisei = normalized.match(/平成(元|\d+)年/);
  if (heisei?.[1]) {
    const eraYear = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + eraYear;
  }

  return null;
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
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * PDF テキストの正規化。
 *
 * unpdf で抽出したテキストは各文字の間にスペースが入ることがある。
 * 例: "○ 議 長 （ 小 林 弘 之 君 ）" → "○議長（小林弘之君）"
 */
export function normalizePdfText(text: string): string {
  const CJK = "[\\u3000-\\u9FFF\\uF900-\\uFAFF\\uFF00-\\uFFEF]";
  const PUNCT = "[（）「」『』【】〔〕・、。！？〜～：；]";
  const MARKER = "[○◯◎●◇]";
  const ANY_CJK = `(?:${CJK}|${PUNCT}|${MARKER})`;

  let result = text;
  for (let i = 0; i < 6; i++) {
    const prev = result;
    result = result.replace(new RegExp(`(${ANY_CJK}) +(${ANY_CJK})`, "g"), "$1$2");
    if (result === prev) break;
  }

  return result;
}
