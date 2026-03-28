/**
 * 浜中町議会 — 共通ユーティリティ
 *
 * サイト: https://www.townhamanaka.jp/gyousei/kaigi/
 * 1ページに定例会・臨時会の PDF 一覧がまとまっている。
 */

export const BASE_ORIGIN = "https://www.townhamanaka.jp";

const LIST_PATH = "/gyousei/kaigi/";
const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";
const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

function toHalfWidthDigits(value: string): string {
  return value.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

/** 会議タイプを判定する */
export function detectMeetingType(title: string): string {
  if (/臨時/.test(title)) return "extraordinary";
  if (/委員会/.test(title)) return "committee";
  return "plenary";
}

/** 一覧ページ URL を構築する */
export function buildListUrl(baseUrl: string): string {
  return new URL(LIST_PATH, baseUrl || BASE_ORIGIN).toString();
}

/** ドキュメント URL を絶対 URL に変換する */
export function buildDocumentUrl(href: string, pageUrl: string): string {
  return new URL(href, pageUrl).toString();
}

/** HTML を取得する */
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

/** PDF を取得する */
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
 * リンクテキストから開催日を抽出する。
 * 例:
 *   令和7年第1回定例会 1日目（3月5日）
 *   平成31年第1回臨時会（2月15日）
 */
export function parseDateText(text: string): string | null {
  const normalized = toHalfWidthDigits(text).replace(/\s+/g, "");
  const match = normalized.match(/(令和|平成)(元|\d+)年[\s\S]*?(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, eraYearText, monthText, dayText] = match;
  const eraYear = eraYearText === "元" ? 1 : Number(eraYearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const westernYear = era === "令和" ? eraYear + 2018 : eraYear + 1988;
  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
