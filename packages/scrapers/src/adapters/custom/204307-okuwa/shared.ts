/**
 * 大桑村議会 — 共通ユーティリティ
 *
 * サイト: https://www.vill.okuwa.lg.jp/okuwa/gikai/index.html
 * 自治体コード: 204307
 *
 * 会議録テキストは公開されていないため、議会だより PDF のみを対象とする。
 */

export const BASE_ORIGIN = "https://www.vill.okuwa.lg.jp";

/**
 * 議会だより一覧ページの URL 一覧。
 * 新しい順に並べる（令和5年〜 → 平成30年〜令和4年 → 平成25年〜平成29年）。
 */
export const LIST_PAGES: Array<{ url: string; docDir: string }> = [
  {
    url: `${BASE_ORIGIN}/okuwa/gikai/gikaidayori/gikaidayori.html`,
    docDir: "documents/gikaidayori",
  },
  {
    url: `${BASE_ORIGIN}/okuwa/gikai/gikaidayori/gikaidayori_H30-R4.html`,
    docDir: "documents/gikaidayori_H30-R4",
  },
  {
    url: `${BASE_ORIGIN}/okuwa/gikai/gikaidayori/gikaidayori_2.html`,
    docDir: "documents/gikaidayori_2",
  },
];

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[okuwa] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[okuwa] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** バイナリデータを fetch して返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[okuwa] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.warn(
      `[okuwa] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** 全角数字を半角に変換する */
export function toHalfWidth(s: string): string {
  return s.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦テキストから西暦年を変換する。
 * 「元」年に対応する。
 * 例: "令和6年" → 2024, "令和元年" → 2019, "平成31年" → 2019
 */
export function parseWarekiYear(text: string): number | null {
  const normalized = toHalfWidth(text);

  const reiwa = normalized.match(/令和(元|\d+)年/);
  if (reiwa?.[1]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    return 2018 + n;
  }

  const heisei = normalized.match(/平成(元|\d+)年/);
  if (heisei?.[1]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    return 1988 + n;
  }

  return null;
}

/**
 * 和暦テキストから YYYY-MM-DD 形式の日付を返す。
 * 日が省略された場合は "01" を使用する。
 * 解析できない場合は null を返す。
 */
export function parseWarekiDate(text: string): string | null {
  const normalized = toHalfWidth(text);

  // 令和/平成 + 元/数字 + 年 + 月 + 日
  const reiwa = normalized.match(
    /令和(元|\d+)年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?/,
  );
  if (reiwa?.[1] && reiwa[2]) {
    const n = reiwa[1] === "元" ? 1 : parseInt(reiwa[1], 10);
    const year = 2018 + n;
    const month = parseInt(reiwa[2], 10).toString().padStart(2, "0");
    const day = reiwa[3]
      ? parseInt(reiwa[3], 10).toString().padStart(2, "0")
      : "01";
    return `${year}-${month}-${day}`;
  }

  const heisei = normalized.match(
    /平成(元|\d+)年\s*(\d{1,2})\s*月(?:\s*(\d{1,2})\s*日)?/,
  );
  if (heisei?.[1] && heisei[2]) {
    const n = heisei[1] === "元" ? 1 : parseInt(heisei[1], 10);
    const year = 1988 + n;
    const month = parseInt(heisei[2], 10).toString().padStart(2, "0");
    const day = heisei[3]
      ? parseInt(heisei[3], 10).toString().padStart(2, "0")
      : "01";
    return `${year}-${month}-${day}`;
  }

  return null;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
