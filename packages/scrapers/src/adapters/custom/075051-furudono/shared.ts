/**
 * 古殿町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.furudono.fukushima.jp/gikai/kaigiroku/3318
 */

export const BASE_ORIGIN = "https://www.town.furudono.fukushima.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

export function detectMeetingType(
  title: string,
): "plenary" | "committee" | "extraordinary" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

export function parseWarekiYear(text: string): number | null {
  const normalized = toHalfWidth(text).replace(/\s+/g, "");
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  if (Number.isNaN(eraYear)) return null;

  return match[1] === "令和" ? eraYear + 2018 : eraYear + 1988;
}

export function parseWarekiDate(text: string): string | null {
  const normalized = toHalfWidth(text).replace(/\s+/g, "");
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  if (Number.isNaN(eraYear)) return null;

  const year = match[1] === "令和" ? eraYear + 2018 : eraYear + 1988;
  const month = Number(match[3]);
  const day = Number(match[4]);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
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
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export function extractExternalIdKey(pdfUrl: string): string | null {
  const match = pdfUrl.match(/\/file\/(\d+)\/([^/?#]+)\.pdf$/i);
  if (!match) return null;
  return `${match[1]}_${match[2]}`;
}
