/**
 * 中之条町議会（群馬県） — 共通ユーティリティ
 *
 * サイト: https://www.town.nakanojo.gunma.jp/site/nakanojo-gikai/1097.html
 * 自治体コード: 104213
 * 分類: PDF 直接掲載（単一ページに全会議録を一覧掲載）
 */

export const BASE_ORIGIN = "https://www.town.nakanojo.gunma.jp";

/** 会議録一覧ページのパス */
export const LIST_PAGE_PATH = "/site/nakanojo-gikai/1097.html";

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
      console.warn(`[104213-nakanojo] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[104213-nakanojo] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
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
      console.warn(`[104213-nakanojo] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[104213-nakanojo] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** 会議タイプを検出 */
export function detectMeetingType(title: string): "plenary" | "extraordinary" {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/**
 * 和暦テキストから西暦年を取得する。
 * 「元」年に対応。
 */
export function eraToWestern(era: string, eraYearStr: string): number {
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  if (era === "昭和") return eraYear + 1925;
  return eraYear;
}

/**
 * 全角数字・全角スペースを半角に変換する。
 */
export function normalizeFullWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ");
}

/**
 * PDF テキスト抽出で発生する文字間スペースを除去する。
 *
 * unpdf で抽出されたテキストは日本語文字間に半角スペースが入ることがある。
 * CJK 文字間の単一スペースを繰り返し除去する。
 */
export function deSpacePdfText(text: string): string {
  const cjkPattern =
    /([\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\uFF01-\uFF60\u3001-\u303F]) ([\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\uFF01-\uFF60\u3001-\u303F])/g;

  let prev = "";
  let result = text;
  while (result !== prev) {
    prev = result;
    result = result.replace(cjkPattern, "$1$2");
  }
  return result;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
