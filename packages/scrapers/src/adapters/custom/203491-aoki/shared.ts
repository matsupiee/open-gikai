/**
 * 青木村議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.vill.aoki.nagano.jp/gikai03.html
 * 自治体コード: 203491
 */

export const BASE_ORIGIN = "https://www.vill.aoki.nagano.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function detectMeetingType(
  title: string,
): "plenary" | "committee" | "extraordinary" {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

export function buildListUrl(baseUrl: string): string {
  try {
    return new URL(baseUrl, BASE_ORIGIN).toString();
  } catch {
    return baseUrl;
  }
}

export function buildDocumentUrl(href: string): string {
  try {
    return new URL(href, BASE_ORIGIN).toString();
  } catch {
    return href;
  }
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
    console.warn(
      `fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
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

export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (ch) =>
    String.fromCharCode(ch.charCodeAt(0) - 0xfee0),
  );
}

export function normalizeYearLabel(text: string): string {
  const normalized = toHalfWidth(text).replace(/\s+/g, "");
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return text.trim();
  return `${match[1]}${match[2]}年`;
}

export function parseHeadingYear(text: string): number | null {
  const normalized = toHalfWidth(text).replace(/\s+/g, "");

  const reiwaMatch = normalized.match(/令和(元|\d+)年/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : Number(reiwaMatch[1]);
    return 2018 + eraYear;
  }

  const heiseiMatch = normalized.match(/平成(元|\d+)年/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : Number(heiseiMatch[1]);
    return 1988 + eraYear;
  }

  return null;
}

/**
 * PDF 冒頭にある「令 和 ７ 年 ３ 月 ４ 日」や「平成３１年３月６日」を拾う。
 * 文字間に空白が挟まるケースを想定して各成分の空白を許容する。
 */
export function extractHeldOnFromText(text: string): string | null {
  const normalized = toHalfWidth(text);
  const match = normalized.match(
    /((?:令\s*和)|(?:平\s*成))\s*(元|[\d\s]+)\s*年\s*([\d\s]+)\s*月\s*([\d\s]+)\s*日/,
  );
  if (!match) return null;

  const era = match[1]!.replace(/\s+/g, "");
  const eraYearText = match[2]!.replace(/\s+/g, "");
  const monthText = match[3]!.replace(/\s+/g, "");
  const dayText = match[4]!.replace(/\s+/g, "");

  const eraYear = eraYearText === "元" ? 1 : Number(eraYearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (
    !Number.isFinite(eraYear) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }

  const westernYear = era === "令和" ? 2018 + eraYear : 1988 + eraYear;
  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
