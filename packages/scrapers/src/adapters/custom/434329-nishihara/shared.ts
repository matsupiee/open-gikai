/**
 * 西原村議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.vill.nishihara.kumamoto.jp/gikai/list00557.html
 *
 * 西原村は村公式サイト内で PDF ベースの議事録を公開している。
 * 令和5年以降は会議ごとに個別の詳細ページ（kiji）を経由してPDFにアクセスする。
 * 平成24年〜令和4年分は1つの記事ページ（kiji003295）にまとめてPDFが列挙されている。
 */

export const BASE_ORIGIN = "https://www.vill.nishihara.kumamoto.jp";

/** 定例会会議録一覧ページ */
export const REGULAR_LIST_URL = `${BASE_ORIGIN}/gikai/list00557.html`;

/** 臨時会会議録一覧ページ */
export const EXTRA_LIST_URL = `${BASE_ORIGIN}/gikai/list00558.html`;

/** 平成24年〜令和4年まとめページ一覧 */
export const ARCHIVE_LIST_URL = `${BASE_ORIGIN}/gikai/list00651.html`;

/** 平成24年〜令和4年まとめページの kiji ID */
export const ARCHIVE_KIJI_ID = "003295";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(title: string): "plenary" | "committee" | "extraordinary" {
  if (title.includes("委員会")) return "committee";
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
      console.warn(`fetchPage failed: ${url} status=${res.status}`);
      return null;
    }
    return await res.text();
  } catch (e) {
    console.warn(`fetchPage error: ${url}`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** fetch して ArrayBuffer を返す（PDF 用） */
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

/**
 * 相対 URL または絶対 URL を BASE_ORIGIN を基準に絶対 URL へ変換する。
 */
export function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  if (href.startsWith("/")) return `${BASE_ORIGIN}${href}`;
  return `${BASE_ORIGIN}/gikai/${href}`;
}

/**
 * kiji 番号から詳細ページ URL を組み立てる。
 * e.g., "0031869" → "https://www.vill.nishihara.kumamoto.jp/gikai/kiji0031869/index.html"
 */
export function buildDetailUrl(kijiId: string): string {
  return `${BASE_ORIGIN}/gikai/kiji${kijiId}/index.html`;
}

/**
 * kiji 番号から externalId 用のキーを生成する。
 * e.g., "0031869" → "nishihara_0031869"
 */
export function buildExternalId(kijiId: string): string {
  return `nishihara_${kijiId}`;
}

/**
 * 和暦の日付文字列から YYYY-MM-DD を抽出する。
 * e.g., "令和６年９月９日" → "2024-09-09"
 * e.g., "令和元年６月１日（土曜日）" → "2019-06-01"
 * 全角数字・半角数字の両方に対応する。
 */
export function parseJapaneseDate(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  // 令和元年 = 2019, 平成元年 = 1989
  const westernYear = eraYear + (era === "平成" ? 1988 : 2018);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * タイトルから年を抽出する（西暦）。
 * e.g., "令和６年第４回定例会会議録" → 2024
 * e.g., "平成２４年第１回定例会会議録" → 2012
 */
export function extractYearFromTitle(title: string): number | null {
  // 全角数字を半角に変換
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1]!;
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);

  return eraYear + (era === "平成" ? 1988 : 2018);
}
