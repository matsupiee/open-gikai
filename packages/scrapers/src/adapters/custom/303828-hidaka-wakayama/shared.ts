/**
 * 日高町議会（和歌山県） — 共通ユーティリティ
 *
 * サイト: http://www.town.wakayama-hidaka.lg.jp/docs/2014090500409/
 * 議会だより PDF を一覧ページから収集し、一般質問を抽出する。
 */

export const BASE_ORIGIN = "http://www.town.wakayama-hidaka.lg.jp";
export const LIST_PAGE_URL = `${BASE_ORIGIN}/docs/2014090500409/`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function normalizeFullWidthDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30),
  );
}

export function convertJapaneseEra(era: string, eraYear: string): number | null {
  const year = eraYear === "元" ? 1 : Number(normalizeFullWidthDigits(eraYear));
  if (Number.isNaN(year)) return null;

  if (era === "令和") return year + 2018;
  if (era === "平成") return year + 1988;
  return null;
}

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

export function detectMeetingType(title: string): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}
