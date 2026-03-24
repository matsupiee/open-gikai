/**
 * 御代田町議会 -- 共通ユーティリティ
 *
 * サイト: https://www.town.miyota.nagano.jp/
 * 自治体コード: 203238
 */

export const BASE_ORIGIN = "https://www.town.miyota.nagano.jp";

/** 会議録一覧ページの URL */
export const KAIGIROKU_LIST_URL =
  "https://www.town.miyota.nagano.jp/category/kaigiroku/index.html";

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
 * 例: "令和６年" → 2024, "平成２５年" → 2013, "令和元年" → 2019
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

/**
 * PDF テキストの正規化。
 *
 * unpdf で抽出したテキストは各文字の間にスペースが入ることがある。
 * 例: "○ 議 長 （ 荻 原 謙 一 君 ）" → "○議長（荻原謙一君）"
 *
 * CJK 文字、括弧、記号の間のスペースを除去し、
 * 英数字・欧文の前後の余分なスペースは 1 つに縮約する。
 */
export function normalizePdfText(text: string): string {
  // CJK統合漢字・ひらがな・カタカナ・全角記号などの範囲
  const CJK = "[\\u3000-\\u9FFF\\uF900-\\uFAFF\\uFF00-\\uFFEF]";
  const PUNCT = "[（）「」『』【】〔〕・、。！？〜～：；]";
  const MARKER = "[○◯◎●]";
  const ANY_CJK = `(?:${CJK}|${PUNCT}|${MARKER})`;

  // CJK文字間・記号間のスペースを除去（繰り返し適用）
  let result = text;
  // スペース1個以上を挟んだ CJK 文字同士を結合
  result = result.replace(
    new RegExp(`(${ANY_CJK}) +(${ANY_CJK})`, "g"),
    "$1$2"
  );
  // 複数回適用（例: A B C → AB C → ABC）
  result = result.replace(
    new RegExp(`(${ANY_CJK}) +(${ANY_CJK})`, "g"),
    "$1$2"
  );
  result = result.replace(
    new RegExp(`(${ANY_CJK}) +(${ANY_CJK})`, "g"),
    "$1$2"
  );
  // 5回繰り返せば十分
  for (let i = 0; i < 5; i++) {
    const prev = result;
    result = result.replace(
      new RegExp(`(${ANY_CJK}) +(${ANY_CJK})`, "g"),
      "$1$2"
    );
    if (result === prev) break;
  }

  return result;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
