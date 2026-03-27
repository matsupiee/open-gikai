/**
 * 笛吹市議会 — 共通ユーティリティ
 *
 * サイト: https://www.city.fuefuki.yamanashi.jp/shisejoho/shigikai/gijiroku/index.html
 * 自治体コード: 192112
 */

export const BASE_ORIGIN = "https://www.city.fuefuki.yamanashi.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const HTML_FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(HTML_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[192112-fuefuki] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`[192112-fuefuki] fetchPage error: ${url}`, e instanceof Error ? e.message : e);
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
      console.warn(`[192112-fuefuki] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[192112-fuefuki] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export function detectMeetingType(title: string): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

export function toHankaku(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xff10 + 0x30),
  );
}

export function collapseForMatching(text: string): string {
  return toHankaku(text).replace(/\s/g, "");
}
