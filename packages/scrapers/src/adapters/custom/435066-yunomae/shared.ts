/**
 * 湯前町議会 会議録 — 共通ユーティリティ
 *
 * サイト: https://www.town.yunomae.lg.jp/gikai/list00557.html
 *
 * 湯前町は独自 CMS で PDF ベースの議事録を公開している。
 * 一覧ページ（list00557.html）に年度別ページへのリンクが並び、
 * 各年度ページ（gikai/list{番号}.html）から kiji ページへリンクされ、
 * kiji ページ（gikai/kiji{番号}/index.html）から PDF URL を収集する。
 */

export const BASE_ORIGIN = "https://www.town.yunomae.lg.jp";
export const LIST_URL = `${BASE_ORIGIN}/gikai/list00557.html`;

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
 * 年度別一覧ページの URL を組み立てる。
 * e.g., listId="00962" → "https://www.town.yunomae.lg.jp/gikai/list00962.html"
 */
export function buildYearListUrl(listId: string): string {
  return `${BASE_ORIGIN}/gikai/list${listId}.html`;
}

/**
 * kiji 番号から年度別会議録詳細ページの URL を組み立てる。
 * e.g., kijiId="4967" → "https://www.town.yunomae.lg.jp/gikai/kiji4967/index.html"
 */
export function buildKijiPageUrl(kijiId: string): string {
  return `${BASE_ORIGIN}/gikai/kiji${kijiId}/index.html`;
}

/**
 * kiji 番号と PDF URL からユニークな外部 ID を生成する。
 * e.g., "4429", "3_4429_up_lhegyoei.pdf" → "yunomae_4429_lhegyoei"
 */
export function buildExternalId(kijiId: string, pdfUrl: string): string {
  // ランダム文字列部分を抽出してユニーク ID に使用
  const randomMatch = pdfUrl.match(/_up_([a-z0-9]+)\.pdf$/i);
  const randomPart = randomMatch?.[1] ?? pdfUrl.replace(/[^a-z0-9]/gi, "").slice(-8);
  return `yunomae_${kijiId}_${randomPart}`;
}

/**
 * 和暦の日付文字列から YYYY-MM-DD を抽出する。
 * 年情報がない場合は yearHint（西暦）を使用して月日のみ変換する。
 *
 * e.g., "令和7年第3回定例会（3月6日～3月14日）" → "2025-03-06"
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
 * e.g., "令和7年湯前町議会会議録" → 2025
 * e.g., "令和元年湯前町議会会議録" → 2019
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
