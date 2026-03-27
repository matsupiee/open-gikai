/**
 * 郡上市議会（岐阜県） — 共通ユーティリティ
 *
 * サイト: https://www.city.gujo.gifu.jp/admin/gikai_kaigiroku/
 * 自治体コード: 212199
 */

export const BASE_ORIGIN = "https://www.city.gujo.gifu.jp";
export const INDEX_PATH = "/admin/gikai_kaigiroku/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

export function buildListUrl(baseUrl?: string): string {
  if (baseUrl && /^https?:\/\//.test(baseUrl)) return baseUrl;
  return `${BASE_ORIGIN}${INDEX_PATH}`;
}

export function buildDocumentUrl(href: string): string {
  if (/^https?:\/\//.test(href)) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
}

/** fetch して UTF-8 テキストを返す */
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

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
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

export function detectMeetingType(
  title: string,
): "plenary" | "committee" | "extraordinary" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 全角数字・全角空白を半角に正規化する。
 */
export function normalizeFullWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ");
}

/**
 * PDF テキスト抽出で発生する文字間スペースを除去する。
 */
export function deSpacePdfText(text: string): string {
  const cjkPattern =
    /([\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\uFF01-\uFF60\u3001-\u303F]) ([\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\uFF01-\uFF60\u3001-\u303F])/g;

  let prev = "";
  let result = text;
  while (result !== prev) {
    prev = result;
    result = result.replace(cjkPattern, "$1$2");
  }
  return result;
}

export function stripTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#12288;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export function collapseWhitespace(text: string): string {
  return normalizeFullWidth(text).replace(/\s+/g, " ").trim();
}

/**
 * 和暦テキストから西暦年を取得する。
 * 令和元年 / 平成元年 に対応。
 */
export function extractWesternYear(text: string): number | null {
  const normalized = normalizeFullWidth(text);
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYearStr = match[2]!;
  const eraYear = eraYearStr === "元" ? 1 : Number(eraYearStr);

  if (era === "令和") return 2018 + eraYear;
  return 1988 + eraYear;
}

/**
 * 西暦年に対応する一覧ページタイトル候補。
 * 2019 年は平成31年と令和元年の 2 ページに分かれている。
 */
export function buildYearPageTitles(year: number): string[] {
  if (year === 2019) {
    return ["令和元年郡上市議会会議録", "平成31年郡上市議会会議録"];
  }
  if (year >= 2020) {
    return [`令和${year - 2018}年郡上市議会会議録`];
  }
  if (year >= 2009) {
    return [`平成${year - 1988}年郡上市議会会議録`];
  }
  if (year >= 2004) {
    return ["平成16年～平成20年郡上市議会会議録"];
  }
  return [];
}
