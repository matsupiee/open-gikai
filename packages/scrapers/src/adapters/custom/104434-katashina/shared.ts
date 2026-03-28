/**
 * 片品村議会（群馬県） — 共通ユーティリティ
 *
 * サイト: https://www.vill.katashina.gunma.jp/gaiyou/kakuka/gikai/2016-0330-1855-38.html
 * 自治体コード: 104434
 */

export const BASE_ORIGIN = "https://www.vill.katashina.gunma.jp";
export const LIST_PAGE_URL =
  `${BASE_ORIGIN}/gaiyou/kakuka/gikai/2016-0330-1855-38.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";
const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`[104434-katashina] fetchPage failed: ${url} status=${response.status}`);
      return null;
    }
    return await response.text();
  } catch (error) {
    console.warn(
      `[104434-katashina] fetchPage error: ${url}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(PDF_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`[104434-katashina] fetchBinary failed: ${url} status=${response.status}`);
      return null;
    }
    return await response.arrayBuffer();
  } catch (error) {
    console.warn(
      `[104434-katashina] fetchBinary error: ${url}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export function toHalfWidth(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

export function collapseWhitespace(text: string): string {
  return toHalfWidth(text)
    .replace(/&nbsp;/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/　+/g, " ")
    .trim();
}

export function resolveUrl(href: string, baseUrl = LIST_PAGE_URL): string {
  return new URL(href, baseUrl).toString();
}

export function parseWarekiYear(text: string): number | null {
  const normalized = toHalfWidth(text);

  const reiwaMatch = normalized.match(/令和(元|\d+)年?/);
  if (reiwaMatch) {
    const eraYear = reiwaMatch[1] === "元" ? 1 : Number(reiwaMatch[1]);
    return 2018 + eraYear;
  }

  const heiseiMatch = normalized.match(/平成(元|\d+)年?/);
  if (heiseiMatch) {
    const eraYear = heiseiMatch[1] === "元" ? 1 : Number(heiseiMatch[1]);
    return 1988 + eraYear;
  }

  return null;
}

export function parseWarekiDate(text: string): string | null {
  const normalized = toHalfWidth(text).replace(/\s+/g, "");
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  const year = match[1] === "令和" ? 2018 + eraYear : 1988 + eraYear;
  const month = Number(match[3]);
  const day = Number(match[4]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function detectMeetingType(title: string): "plenary" | "committee" | "extraordinary" {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
  return "plenary";
}

export function extractExternalIdKey(pdfUrl: string): string | null {
  const fileName = new URL(pdfUrl).pathname.split("/").pop() ?? "";
  return fileName.replace(/\.pdf$/i, "") || null;
}
