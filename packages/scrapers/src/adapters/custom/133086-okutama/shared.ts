/**
 * 奥多摩町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.okutama.tokyo.jp/gyosei/8/okutamachogikai/kaigiroku/index.html
 * SMART CMS による年度別ページ + PDF/Word ファイル公開。
 */

export const BASE_ORIGIN = "https://www.town.okutama.tokyo.jp";
export const TREE_JSON_URL =
  "https://www.town.okutama.tokyo.jp/gyosei/8/okutamachogikai/kaigiroku/index.tree.json";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
export const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
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
      console.warn(
        `[133086-okutama] fetchPage failed: ${url} status=${res.status}`,
      );
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(
      `[133086-okutama] fetchPage error: ${url}`,
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
      console.warn(
        `[133086-okutama] fetchBinary failed: ${url} status=${res.status}`,
      );
      return null;
    }
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(
      `[133086-okutama] fetchBinary error: ${url}`,
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

/**
 * プロトコル相対 URL（//example.com/...）を https: を付与して絶対 URL に変換する。
 * 既に http/https で始まる場合はそのまま返す。
 */
export function normalizeUrl(href: string): string {
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("http")) return href;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return `${BASE_ORIGIN}/${href}`;
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
