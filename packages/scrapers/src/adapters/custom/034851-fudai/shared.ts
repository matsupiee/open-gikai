/**
 * 普代村議会 — 共通ユーティリティ
 *
 * サイト: https://www.vill.fudai.iwate.jp/docs/300.html
 * PDF ベースの議事録公開。年度ごとの PDF リンクが 1 ページに並ぶ。
 */

export const BASE_ORIGIN = "https://www.vill.fudai.iwate.jp";

const LIST_PATH = "/docs/300.html";
const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (/委員会/.test(title)) return "committee";
  if (/臨時/.test(title)) return "extraordinary";
  return "plenary";
}

/** 一覧ページ URL を構築 */
export function buildListUrl(baseUrl: string): string {
  return new URL(LIST_PATH, baseUrl || BASE_ORIGIN).toString();
}

/** PDF の絶対 URL を構築 */
export function buildDocumentUrl(href: string, pageUrl: string): string {
  return new URL(href, pageUrl).toString();
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

function toHalfWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦テキストから YYYY-MM-DD を返す。
 * 「元年」にも対応する。
 */
export function parseDateText(text: string): string | null {
  const normalized = toHalfWidthDigits(text).replace(/\s+/g, "");
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearStr, monthStr, dayStr] = match;
  const eraYear = eraYearStr === "元" ? 1 : Number(eraYearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else if (era === "平成") westernYear = eraYear + 1988;
  else return null;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
