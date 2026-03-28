/**
 * 八幡平市議会 -- 共通ユーティリティ
 *
 * サイト:
 *   - 会議録トップ: UTF-8
 *   - 会議録本体: Shift_JIS の静的 HTML / frameset
 */

export const BASE_ORIGIN = "https://www.city.hachimantai.lg.jp";
export const LIST_URL = `${BASE_ORIGIN}/site/gikai/list136.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 全角数字を半角数字に変換する */
export function normalizeDigits(text: string): string {
  return text.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0),
  );
}

/** タイトル等のテキストを軽く正規化する */
export function normalizeText(text: string): string {
  return normalizeDigits(text)
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .replace(/　+/g, " ")
    .trim();
}

/** 和暦の年表記から西暦年を返す */
export function parseWarekiYear(text: string): number | null {
  const normalized = normalizeDigits(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const [, era, eraYearRaw] = match;
  const eraYear = eraYearRaw === "元" ? 1 : Number(eraYearRaw);

  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  return null;
}

/** 月日表記から YYYY-MM-DD を返す */
export function parseMonthDay(text: string, year: number): string | null {
  const normalized = normalizeDigits(text);
  const match = normalized.match(/(\d{1,2})月(\d{1,2})日/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 会議種別を推定する */
export function detectMeetingType(
  title: string,
): "plenary" | "committee" | "extraordinary" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** 相対 URL を絶対 URL に変換する */
export function buildAbsoluteUrl(url: string, base: string = BASE_ORIGIN): string {
  return new URL(url, base).toString();
}

async function fetchDecodedPage(
  url: string,
  encoding: "utf-8" | "shift_jis",
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(`fetchPage failed: ${url} status=${response.status}`);
      return null;
    }

    if (encoding === "utf-8") {
      return await response.text();
    }

    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder("shift_jis");
    return decoder.decode(buffer);
  } catch (error) {
    console.warn(
      `fetchPage error: ${url}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/** UTF-8 ページを取得する */
export async function fetchUtf8Page(url: string): Promise<string | null> {
  return fetchDecodedPage(url, "utf-8");
}

/** Shift_JIS ページを取得する */
export async function fetchShiftJisPage(url: string): Promise<string | null> {
  return fetchDecodedPage(url, "shift_jis");
}
