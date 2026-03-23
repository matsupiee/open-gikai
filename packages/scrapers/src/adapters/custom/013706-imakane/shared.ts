/**
 * 今金町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.imakane.lg.jp/ass/kaigiroku/
 */

export const BASE_ORIGIN = "https://www.town.imakane.lg.jp";
export const LIST_URL = `${BASE_ORIGIN}/ass/kaigiroku/`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** fetch して UTF-8 テキストを返す */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[imakane] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF ダウンロード用） */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[imakane] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/**
 * 和暦年号を西暦に変換する。
 * 「令和X年」「平成XX年」→ 数値
 */
export function toWesternYear(era: string, yearStr: string): number | null {
  const y = parseInt(toHalfWidth(yearStr), 10);
  if (isNaN(y)) return null;
  if (era === "令和") return 2018 + y;
  if (era === "平成") return 1988 + y;
  if (era === "昭和") return 1925 + y;
  return null;
}

/** 全角数字を半角に変換する */
export function toHalfWidth(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦日付文字列を YYYY-MM-DD にパースする。
 * 例: 「令和７年６月１２日」→ "2025-06-12"
 * パース失敗時は null を返す（フォールバック値禁止）。
 */
export function parseJapaneseDate(text: string): string | null {
  const m = text.match(/(令和|平成|昭和)([０-９\d]+)年([０-９\d]+)月([０-９\d]+)日/);
  if (!m) return null;
  const [, era, y, mo, d] = m;
  if (!era || !y || !mo || !d) return null;
  const year = toWesternYear(era, y);
  if (year === null) return null;
  const month = parseInt(toHalfWidth(mo), 10);
  const day = parseInt(toHalfWidth(d), 10);
  if (isNaN(month) || isNaN(day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 会議種別を判定する。
 */
export function detectMeetingType(
  title: string,
): "plenary" | "extraordinary" | "committee" {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * HTML の <a href="...pdf"> から PDF URL を収集する。
 * 相対パスは BASE_ORIGIN と結合して絶対 URL にする。
 */
export function extractPdfLinks(
  html: string,
  baseUrl: string,
): { url: string; text: string }[] {
  const links: { url: string; text: string }[] = [];
  const seen = new Set<string>();

  const regex = /<a\s[^>]*href=["']([^"']+\.pdf[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const m of html.matchAll(regex)) {
    const rawHref = m[1];
    const rawText = m[2];
    if (!rawHref || rawText === undefined) continue;

    // HTML エンティティのデコード
    const href = rawHref.replace(/&amp;/g, "&");
    const text = rawText
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .trim();

    let url: string;
    if (href.startsWith("http://") || href.startsWith("https://")) {
      url = href;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス: baseUrl のディレクトリ部分と結合
      const base = baseUrl.replace(/\/[^/]*$/, "/");
      url = `${base}${href}`;
    }

    if (!seen.has(url)) {
      seen.add(url);
      links.push({ url, text });
    }
  }

  return links;
}

/**
 * 一覧ページから各カテゴリページへのリンクを抽出する。
 * /ass/ 配下の内部リンクを返す。
 */
export function extractCategoryLinks(
  html: string,
  baseUrl: string,
): string[] {
  const links: string[] = [];
  const seen = new Set<string>();

  const regex = /<a\s[^>]*href=["']([^"']+)["'][^>]*>/gi;
  for (const m of html.matchAll(regex)) {
    const rawHref = m[1];
    if (!rawHref) continue;
    const href = rawHref.replace(/&amp;/g, "&");

    let url: string;
    if (href.startsWith("http://") || href.startsWith("https://")) {
      if (!href.includes("town.imakane.lg.jp")) continue;
      url = href;
    } else if (href.startsWith("/")) {
      url = `${BASE_ORIGIN}${href}`;
    } else {
      // 相対パス
      const base = baseUrl.replace(/\/[^/]*$/, "/");
      url = `${base}${href}`;
    }

    // /ass/ 配下のみ対象 & PDF は除く & 一覧ページ自身は除く
    if (
      url.includes("/ass/") &&
      !url.endsWith(".pdf") &&
      !seen.has(url) &&
      url !== LIST_URL &&
      url !== `${BASE_ORIGIN}/ass/`
    ) {
      seen.add(url);
      links.push(url);
    }
  }

  return links;
}
