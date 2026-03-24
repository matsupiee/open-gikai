/**
 * 六戸町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.rokunohe.aomori.jp/docs/2023051900005
 * Joruri CMS による単一ページ PDF 掲載型。
 */

export const LIST_URL =
  "https://www.town.rokunohe.aomori.jp/docs/2023051900005";
export const FILE_CONTENTS_BASE =
  "https://www.town.rokunohe.aomori.jp/docs/2023051900005/file_contents/";
export const OLD_BASE =
  "https://www.town.rokunohe.aomori.jp/file/chousei/cyougikai/kaigiroku/";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;
const PDF_FETCH_TIMEOUT_MS = 60_000;

/** 会議タイプを検出 */
export function detectMeetingType(text: string): string {
  if (text.includes("臨時")) return "extraordinary";
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
    console.warn(
      `fetchBinary error: ${url}`,
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * 西暦年を和暦テキストに変換する。
 * e.g., 2025 → ["令和7年"], 2019 → ["令和元年", "平成31年"]
 */
export function toJapaneseEra(year: number): string[] {
  const results: string[] = [];

  if (year >= 2020) {
    results.push(`令和${year - 2018}年`);
  } else if (year === 2019) {
    results.push("令和元年");
    results.push("平成31年");
  } else if (year >= 1989) {
    const eraYear = year - 1988;
    results.push(eraYear === 1 ? "平成元年" : `平成${eraYear}年`);
  }

  return results;
}

/**
 * PDF の href を絶対 URL に変換する。
 * - `file_contents/` で始まる場合: FILE_CONTENTS_BASE + filename
 * - `../../file/` で始まる場合: OLD_BASE + filename
 * - すでに絶対パスの場合はそのまま
 */
export function resolveHref(href: string): string {
  if (href.startsWith("http")) {
    return href;
  }
  if (href.startsWith("file_contents/")) {
    const filename = href.replace("file_contents/", "");
    return FILE_CONTENTS_BASE + filename;
  }
  if (href.includes("/kaigiroku/")) {
    // ../../file/chousei/cyougikai/kaigiroku/{filename}.pdf
    const filename = href.split("/kaigiroku/")[1]!;
    return OLD_BASE + filename;
  }
  // 絶対パス
  if (href.startsWith("/")) {
    return `https://www.town.rokunohe.aomori.jp${href}`;
  }
  return href;
}
