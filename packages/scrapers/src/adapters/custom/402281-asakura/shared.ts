/**
 * 朝倉市議会（福岡県） — 共通ユーティリティ
 *
 * サイト: https://www.city.asakura.lg.jp/www/genre/1000000000015/index.html
 * 自治体コード: 402281
 *
 * 独自 CMS の HTML ページ配下に、会議ごとの PDF 会議録を掲載している。
 */

export const BASE_ORIGIN = "https://www.city.asakura.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30),
  );
}

export function toAbsoluteUrl(href: string, baseUrl: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  const base = baseUrl.replace(/\/[^/]*$/, "/");
  return `${base}${href.replace(/^\.\//, "")}`;
}

export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("臨時")) return "extraordinary";
  if (title.includes("委員")) return "committee";
  return "plenary";
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

export function eraToWesternYear(era: string, yearPart: string): number | null {
  const eraYear = yearPart === "元" ? 1 : parseInt(toHalfWidth(yearPart), 10);
  if (Number.isNaN(eraYear)) return null;
  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

export function parseWarekiYear(text: string): number | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;
  return eraToWesternYear(match[1]!, match[2]!);
}

export function parseDateText(text: string): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年[^年]*?(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const year = eraToWesternYear(match[1]!, match[2]!);
  if (!year) return null;

  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseMonthDayText(text: string, year: number): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const month = parseInt(match[1]!, 10);
  const day = parseInt(match[2]!, 10);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function toJapaneseEraLabels(year: number): string[] {
  if (year >= 2019) {
    const reiwa = year - 2018;
    if (reiwa === 1) return ["令和元年", "平成31年（令和元年）", "平成31年"];
    return [`令和${reiwa}年`];
  }

  const heisei = year - 1988;
  if (heisei <= 0) return [];
  if (heisei === 31) return ["平成31年", "平成31年（令和元年）", "令和元年"];
  if (heisei === 1) return ["平成元年"];
  return [`平成${heisei}年`];
}
