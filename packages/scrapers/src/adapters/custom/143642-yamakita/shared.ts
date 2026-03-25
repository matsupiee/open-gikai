/**
 * 山北町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.yamakita.kanagawa.jp/category/14-3-0-0-0.html
 *
 * 山北町は公式サイト上で PDF ファイルとして年度別に会議録を公開している。
 * 専用の会議録検索システムはなく、HTML 上に本文テキストは表示されない。
 */

export const BASE_ORIGIN = "https://www.town.yamakita.kanagawa.jp";
export const LIST_URL = `${BASE_ORIGIN}/category/14-3-0-0-0.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

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
      signal: AbortSignal.timeout(60_000),
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
 * 詳細ページの URL を組み立てる。
 * e.g., pageId="0000006954" → "https://www.town.yamakita.kanagawa.jp/0000006954.html"
 */
export function buildDetailUrl(pageId: string): string {
  return `${BASE_ORIGIN}/${pageId}.html`;
}

/**
 * pageId から externalId 用のキーを生成する。
 * e.g., "0000006954" → "yamakita_0000006954"
 */
export function buildExternalId(pageId: string): string {
  return `yamakita_${pageId}`;
}

/**
 * 和暦の日付文字列から YYYY-MM-DD を抽出する。
 * e.g., "令和7年9月3日" → "2025-09-03"
 * e.g., "平成30年12月4日" → "2018-12-04"
 */
export function parseJapaneseDate(text: string): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  const match = normalized.match(
    /(令和|平成)(元|\d+)年(\d+)月(\d+)日/
  );
  if (!match) return null;

  const era = match[1];
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  // 令和元年 = 2019, 平成元年 = 1989
  const westernYear = eraYear + (era === "平成" ? 1988 : 2018);

  return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * リンクテキストから開催年（西暦）を推定する。
 * e.g., "令和7年第3回定例会会議録" → 2025
 * e.g., "平成30年第4回定例会会議録" → 2018
 */
export function extractYearFromTitle(title: string): number | null {
  const normalized = title.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );
  const match = normalized.match(/(令和|平成)(元|\d+)年/);
  if (!match) return null;

  const era = match[1];
  const eraYear = match[2] === "元" ? 1 : parseInt(match[2]!, 10);
  return eraYear + (era === "平成" ? 1988 : 2018);
}
