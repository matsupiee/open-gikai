/**
 * みなかみ町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.minakami.gunma.jp/politics/08gikai/gijiroku/index.html
 * PDF ベースの議事録公開。年度別ページに PDF リンクを掲載。
 */

export const BASE_ORIGIN = "https://www.town.minakami.gunma.jp";
export const BASE_PATH = "/politics/08gikai/gijiroku";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/**
 * 年度別ページの URL マッピング（トップページから収集する年度別 URL）。
 * CMS 生成 ID 形式（令和元〜7年）と h{年数}.html 形式（平成17〜30年）が混在する。
 */
export const YEAR_PAGE_URLS: Record<number, string> = {
  2025: "2025-0324-1404-71.html",
  2024: "2024-0327-1106-66.html",
  2023: "2023-0414-1000-66.html",
  2022: "2022-0602-1524-66.html",
  2021: "2021-0610-1548-66.html",
  2020: "2020-0630-1414-71.html",
  // 2019年は令和元年（R1）のページ
  2019: "2019-0925-1654-66.html",
  2018: "h30.html",
  2017: "h29.html",
  2016: "h28.html",
  2015: "h27.html",
  2014: "h26.html",
  2013: "h25.html",
  2012: "h24.html",
  2011: "h23.html",
  2010: "h22.html",
  2009: "h21.html",
  2008: "h20.html",
  2007: "h19.html",
  2006: "h18.html",
  2005: "h17.html",
};

/**
 * 2019年は令和元年と平成31年で別ページが存在する。
 * 平成31年（2019年）のページ URL。
 */
export const YEAR_PAGE_URL_H31 = "2019-0625-1352-66.html";

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("臨時")) return "extraordinary";
  return "plenary";
}

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn(`[104493-minakami] fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[104493-minakami] fetchPage error: ${url}`,
      e instanceof Error ? e.message : e,
    );
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
      console.warn(`[104493-minakami] fetchBinary failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[104493-minakami] fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 全角数字・全角スペースを半角に変換する。
 */
export function normalizeFullWidth(text: string): string {
  return text
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ");
}

/**
 * PDF テキスト抽出で発生する文字間スペースを除去する。
 *
 * unpdf で抽出されたテキストは日本語文字間に半角スペースが入ることがある:
 *   "議 長 （ 石 坂 武 君 ）" → "議長（石坂武君）"
 *
 * CJK 文字・ひらがな・カタカナ・全角記号の間の単一スペースを繰り返し除去する。
 * 複数スペース（段落区切り等）は保持する。
 */
export function deSpacePdfText(text: string): string {
  // CJK統合漢字・ひらがな・カタカナ・全角記号・括弧・句読点
  const cjkPattern =
    /([\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\uFF01-\uFF60\u3001-\u303F]) ([\u3041-\u3096\u30A1-\u30FA\u4E00-\u9FFF\uFF01-\uFF60\u3001-\u303F])/g;

  // 変化がなくなるまで繰り返し適用（"A B C" → "ABC" には複数パスが必要）
  let prev = "";
  let result = text;
  while (result !== prev) {
    prev = result;
    result = result.replace(cjkPattern, "$1$2");
  }
  return result;
}

/**
 * 和暦テキストから西暦年を取得する。
 * 「元」年に対応。
 */
export function eraToWestern(era: string, eraYearStr: string): number {
  const eraYear = eraYearStr === "元" ? 1 : parseInt(eraYearStr, 10);
  if (era === "令和") return eraYear + 2018;
  if (era === "平成") return eraYear + 1988;
  if (era === "昭和") return eraYear + 1925;
  return eraYear;
}
