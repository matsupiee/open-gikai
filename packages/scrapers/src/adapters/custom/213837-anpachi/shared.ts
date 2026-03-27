/**
 * 安八町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.anpachi.lg.jp/category/9-0-0-0-0-0-0-0-0-0.html
 * 公式サイトの議会カテゴリ配下に年度別の会議録ページがあり、
 * 各記事ページに PDF が1件ずつ添付されている。
 */

export const BASE_ORIGIN = "https://www.town.anpachi.lg.jp";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議種別を検出する */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** HTML を取得する */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[213837-anpachi] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[213837-anpachi] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
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
      console.warn(`[213837-anpachi] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[213837-anpachi] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/** 相対 URL を絶対 URL に変換する */
export function resolveUrl(baseUrl: string, href: string): string {
  return new URL(href, baseUrl).toString();
}

/** 西暦年を和暦ラベル候補に変換する */
export function toJapaneseEra(year: number): string[] {
  if (year >= 2020) return [`令和${year - 2018}年`];
  if (year === 2019) return ["令和元年", "令和1年", "平成31年"];
  if (year >= 1989) {
    const eraYear = year - 1988;
    return [eraYear === 1 ? "平成元年" : `平成${eraYear}年`];
  }
  return [];
}

/** 全角数字・全角空白を半角に変換する */
export function normalizeFullWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ");
}

/** 文字間スペースを除去しつつ、複数スペースは保持する */
export function deSpacePdfText(text: string): string {
  const cjkPattern =
    /([\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\uFF01-\uFF60\u3001-\u303F]) ([\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\uFF01-\uFF60\u3001-\u303F])/g;

  let previous = "";
  let result = text;
  while (result !== previous) {
    previous = result;
    result = result.replace(cjkPattern, "$1$2");
  }
  return result;
}

/** 和暦日付を YYYY-MM-DD に変換する */
export function parseJapaneseDate(text: string): string | null {
  const normalized = normalizeFullWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年\s*(\d+)月\s*(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : Number(match[2]);
  const month = Number(match[3]);
  const day = Number(match[4]);

  let westernYear: number;
  if (era === "令和") westernYear = eraYear + 2018;
  else westernYear = eraYear + 1988;

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
