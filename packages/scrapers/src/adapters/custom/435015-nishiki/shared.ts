/**
 * 錦町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.kumamoto-nishiki.lg.jp/list00253.html
 *
 * 錦町は独自 CMS で PDF ベースの議事録を公開している。
 * 一覧ページ（list00253.html）に年度別ページへのリンクが並び、
 * 各年度ページ（kiji{記事ID}/index.html）から PDF URL を収集する。
 */

export const BASE_ORIGIN = "https://www.town.kumamoto-nishiki.lg.jp";
export const LIST_URL = `${BASE_ORIGIN}/list00253.html`;

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
 * 年度別ページの URL を組み立てる。
 * e.g., kijiId="003905" → "https://www.town.kumamoto-nishiki.lg.jp/kiji003905/index.html"
 */
export function buildYearPageUrl(kijiId: string): string {
  return `${BASE_ORIGIN}/kiji${kijiId}/index.html`;
}

/**
 * kiji 番号から externalId 用のキーを生成する。
 * e.g., "003905", "1562" → "nishiki_003905_1562"
 */
export function buildExternalId(kijiId: string, fileId: string): string {
  return `nishiki_${kijiId}_${fileId}`;
}

/**
 * PDF URL からファイル ID を抽出する。
 * e.g., "kiji003905/3_905_1562_up_7s5zus0d.pdf" → "1562"
 * e.g., "kiji003905/3_905_1562_up_7s5zus0d.pdf" → "1562"
 */
export function extractFileId(pdfUrl: string): string {
  const match = pdfUrl.match(/3_\d+_(\d+)_up_/);
  return match?.[1] ?? pdfUrl;
}

/**
 * 和暦の日付文字列から YYYY-MM-DD を抽出する。
 * 年情報がない場合は yearHint（西暦）を使用して月日のみ変換する。
 *
 * e.g., "令和6年第1回議会定例会（3月5日～3月12日）" → "2024-03-05"
 * e.g., "令和元年第1回定例会（5月1日）" → "2019-05-01"
 */
export function parseJapaneseDate(text: string, yearHint?: number): string | null {
  // 全角数字を半角に変換
  const normalized = text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0)
  );

  // まず和暦年月日パターンを試みる
  const fullMatch = normalized.match(/(令和|平成)(元|\d+)年.*?(\d+)月(\d+)日/);
  if (fullMatch) {
    const era = fullMatch[1];
    const eraYear = fullMatch[2] === "元" ? 1 : parseInt(fullMatch[2]!, 10);
    const month = parseInt(fullMatch[3]!, 10);
    const day = parseInt(fullMatch[4]!, 10);
    const westernYear = eraYear + (era === "平成" ? 1988 : 2018);
    return `${westernYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // 年情報がない場合は月日のみ抽出して yearHint と組み合わせる
  if (yearHint) {
    const monthDayMatch = normalized.match(/[（(](\d+)月(\d+)日/);
    if (monthDayMatch) {
      const month = parseInt(monthDayMatch[1]!, 10);
      const day = parseInt(monthDayMatch[2]!, 10);
      return `${yearHint}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * タイトル文字列から西暦年を抽出する。
 * e.g., "令和6年第1回議会定例会" → 2024
 * e.g., "令和元年第1回定例会" → 2019
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
