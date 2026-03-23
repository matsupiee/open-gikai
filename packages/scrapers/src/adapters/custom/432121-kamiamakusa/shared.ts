/**
 * 上天草市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.kamiamakusa.kumamoto.jp/
 * 自治体コード: 432121
 */

export const BASE_ORIGIN = "https://www.city.kamiamakusa.kumamoto.jp";

/** 会議録一覧ページのカテゴリ ID */
export const LIST_CATEGORY_ID = 389;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会") || title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦の年表記から西暦を返す。
 * 例: "平成28年" → 2016, "令和元年" → 2019
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

/**
 * "YYYY年MM月DD日" 形式のテキストから ISO 日付文字列を返す。
 * 例: "2016年12月8日" → "2016-12-08"
 */
export function parseJapaneseDate(text: string): string | null {
  const m = text.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const year = m[1]!;
  const month = m[2]!.padStart(2, "0");
  const day = m[3]!.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** fetch して EUC-JP テキストを UTF-8 文字列として返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[432121-kamiamakusa] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    // サイトが EUC-JP のため ArrayBuffer で取得して明示的にデコードする
    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("euc-jp");
    return decoder.decode(buffer);
  } catch (e) {
    console.warn(`[432121-kamiamakusa] fetchPage error: ${url}`, e instanceof Error ? e.message : e);
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
      console.warn(`[432121-kamiamakusa] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[432121-kamiamakusa] fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 一覧ページの URL を組み立てる。
 * pg=0 は省略（1ページ目）、pg=1 以降は ?pg={N} を付与する。
 */
export function buildListUrl(page: number): string {
  const base = `${BASE_ORIGIN}/q/list/${LIST_CATEGORY_ID}.html`;
  if (page === 0) return base;
  return `${base}?pg=${page}`;
}

/** 詳細ページの URL を組み立てる */
export function buildDetailUrl(id: string): string {
  return `${BASE_ORIGIN}/q/aview/${LIST_CATEGORY_ID}/${id}.html`;
}

/** PDF ダウンロード URL を組み立てる */
export function buildPdfUrl(fileParam: string): string {
  return `${BASE_ORIGIN}/dl?q=${fileParam}`;
}
