/**
 * 新ひだか町議会 — 共通ユーティリティ
 *
 * サイト: https://www.shinhidaka-hokkaido.jp/gikai/detail/00000185.html
 * 自治体コード: 016101
 *
 * 会議録は HTML フレームセット形式（令和2年〜令和6年）と PDF 形式（令和7年〜）が混在。
 * 文字コードは Shift_JIS。
 */

export const BASE_ORIGIN_NEW = "https://www.shinhidaka-hokkaido.jp";
export const BASE_ORIGIN_OLD = "http://shinhidaka.hokkai.jp";
export const LIST_PAGE_URL = `${BASE_ORIGIN_NEW}/gikai/detail/00000185.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 全角数字を半角数字に変換する */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦テキストから西暦年を返す。
 * 全角数字にも対応。「元年」表記にも対応。
 * e.g., "令和6年" -> 2024, "令和元年" -> 2019, "平成29年" -> 2017
 */
export function eraToWesternYear(eraText: string): number | null {
  const normalized = toHalfWidth(eraText);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, yearStr] = match;
  const eraYear = yearStr === "元" ? 1 : parseInt(yearStr!, 10);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/** 会議タイトルから会議種別を検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * URL を新ドメイン（www.shinhidaka-hokkaido.jp）に正規化する。
 * 旧ドメイン（shinhidaka.hokkai.jp）は新ドメインに書き換える。
 */
export function normalizeUrl(url: string): string {
  return url
    .replace("http://shinhidaka.hokkai.jp", BASE_ORIGIN_NEW)
    .replace("http://www.shinhidaka-hokkaido.jp", BASE_ORIGIN_NEW);
}

/** fetch して Shift_JIS -> UTF-8 テキストを返す */
export async function fetchShiftJisPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`fetchShiftJisPage failed: ${url} status=${res.status}`);
      return null;
    }
    const buf = await res.arrayBuffer();
    const decoder = new TextDecoder("shift_jis");
    return decoder.decode(buf);
  } catch (e) {
    console.warn(
      `fetchShiftJisPage error: ${url}`,
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
      console.warn(`fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}
