/**
 * 奄美市議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.city.amami.lg.jp/gikai/shise/shigikai/gaiyo.html
 * 自治体コード: 462225
 *
 * 奄美市は公式サイトで年度別に会議録 PDF を公開している。
 * 一部年度は分割 PDF / 分割ページ形式のため、一覧ページと詳細ページの両方を扱う。
 */

export const BASE_ORIGIN = "https://www.city.amami.lg.jp";
export const DEFAULT_LIST_URL = `${BASE_ORIGIN}/gikai/shise/shigikai/gaiyo.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): "plenary" | "extraordinary" {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/** 一覧ページ URL を構築する */
export function buildListUrl(baseUrl: string): string {
  return baseUrl || DEFAULT_LIST_URL;
}

/** 相対 URL を絶対 URL に変換する */
export function buildDocumentUrl(href: string, currentUrl = DEFAULT_LIST_URL): string {
  return new URL(href, currentUrl).toString();
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[462225-amami] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`[462225-amami] fetchPage error: ${url}`, e instanceof Error ? e.message : e);
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
      console.warn(`[462225-amami] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[462225-amami] fetchBinary error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/**
 * 全角数字・全角スペースを半角に変換する。
 * 〇 は ○ に寄せる。
 */
export function normalizeFullWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ")
    .replace(/〇/g, "○");
}

/**
 * PDF テキスト抽出で発生する文字間スペースを除去する。
 *
 * CJK 文字・数字・丸記号・括弧の間の単一スペースを繰り返し除去する。
 */
export function deSpacePdfText(text: string): string {
  const CHAR =
    "[0-9\\u3000-\\u303F\\u3041-\\u3096\\u30A1-\\u30FA\\u3400-\\u9FFF\\uF900-\\uFAFF\\uFF01-\\uFF60]";
  const MARKER = "[○◯◎●]";
  const PUNCT = "[()（）「」『』【】〔〕・、。！？〜～：；]";
  const token = `(?:${CHAR}|${MARKER}|${PUNCT})`;

  let prev = "";
  let result = text;
  while (result !== prev) {
    prev = result;
    result = result.replace(new RegExp(`(${token}) +(${token})`, "g"), "$1$2");
  }
  return result;
}

/**
 * 和暦テキストから西暦年を取得する。
 * 「令和元年」「平成元年」に対応。
 */
export function extractWesternYear(text: string): number | null {
  const normalized = normalizeFullWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const yearPart = match[2]!;
  const eraYear = yearPart === "元" ? 1 : parseInt(yearPart, 10);
  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/** リクエスト間の待機 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
