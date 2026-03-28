/**
 * 笠置町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.town.kasagi.lg.jp/soshiki_view.php?so_cd1=2&so_cd2=0&so_cd3=0&so_cd4=0&so_cd5=0&bn_cd=5
 * 自治体コード: 263648
 *
 * 笠置町は公式サイト内で年度ページごとに会議録詳細ページを公開し、
 * 各詳細ページに PDF 添付ファイルを掲載している。
 */

export const BASE_ORIGIN = "https://www.town.kasagi.lg.jp";

export const LIST_PATH =
  "/soshiki_view.php?so_cd1=2&so_cd2=0&so_cd3=0&so_cd4=0&so_cd5=0&bn_cd=5";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function buildListUrl(baseUrl?: string): string {
  return baseUrl && baseUrl.startsWith("http") ? baseUrl : `${BASE_ORIGIN}${LIST_PATH}`;
}

export function buildDocumentUrl(pathOrUrl: string): string {
  return new URL(pathOrUrl, BASE_ORIGIN).toString();
}

export function detectMeetingType(title: string): string {
  if (title.includes("臨時会")) return "extraordinary";
  if (title.includes("委員会")) return "committee";
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

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function stripTags(text: string): string {
  return decodeHtmlEntities(text).replace(/<[^>]+>/g, "").trim();
}

export function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
}

export function normalizeWhitespace(text: string): string {
  return normalizeDigits(text).replace(/[\s\u3000]+/g, " ").trim();
}

export function eraToWesternYear(eraText: string): number | null {
  const normalized = normalizeDigits(eraText);
  const match = normalized.match(/(令和|平成|昭和)\s*(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : Number(match[2]);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  if (era === "昭和") return eraYear + 1925;
  return null;
}

export function parseJapaneseDate(text: string): string | null {
  const normalized = normalizeDigits(text);
  const match = normalized.match(
    /(令和|平成|昭和)\s*(元|\d+)\s*年\s*(\d+)\s*月\s*(\d+)\s*日/,
  );
  if (!match) return null;

  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  const month = Number(match[3]);
  const day = Number(match[4]);

  let year: number;
  if (match[1] === "令和") year = eraYear + 2018;
  else if (match[1] === "平成") year = eraYear + 1988;
  else if (match[1] === "昭和") year = eraYear + 1925;
  else return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
