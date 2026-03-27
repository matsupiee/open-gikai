/**
 * 七飯町議会 会議録 -- 共通ユーティリティ
 *
 * サイト: https://www.town.nanae.hokkaido.jp/hotnews/category/471.html
 * UTF-8 エンコードの自治体公式サイト。PDF 形式で会議録を公開。
 */

export const BASE_ORIGIN = "https://www.town.nanae.hokkaido.jp";

/** 会議録一覧ページ URL */
export const LIST_PAGE_URL = `${BASE_ORIGIN}/hotnews/category/471.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** 全角数字を半角数字に変換する */
export function normalizeNumbers(text: string): string {
  return text.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xfee0),
  );
}

/**
 * 和暦テキスト（例: "令和6年3月4日"）を "YYYY-MM-DD" に変換する。
 * 期間表記の場合は開始日を返す。
 * 解析できない場合は null を返す。
 */
export function parseHeldOn(text: string): string | null {
  const normalized = normalizeNumbers(text.trim());

  // 令和・平成の和暦パターン（元年対応）
  const match = normalized.match(/(令和|平成)(元|\d+)年(\d+)月(\d+)日/);
  if (!match) return null;

  const [, era, yearStr, monthStr, dayStr] = match;
  const eraYear = yearStr === "元" ? 1 : parseInt(yearStr!, 10);

  let year: number;
  if (era === "令和") {
    year = eraYear + 2018;
  } else if (era === "平成") {
    year = eraYear + 1988;
  } else {
    return null;
  }

  const month = parseInt(monthStr!, 10);
  const day = parseInt(dayStr!, 10);

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * 一覧ページのリンクテキストから西暦年を取得する。
 * 例: "令和6年(2024年)第4回七飯町議会定例会会議録（12月9日～12日）" -> 2024
 * 例: "令和3年（2021年）第2回七飯町議会臨時会会議録（7月19日）" -> 2021
 *
 * サイト上で半角括弧 () と全角括弧 （） が混在しているため、両方にマッチさせる。
 */
export function extractYearFromTitle(title: string): number | null {
  // 半角括弧 (2021年) と全角括弧 （2021年） の両方に対応
  const match = title.match(/[（(](\d{4})年[）)]/);
  if (match?.[1]) {
    return parseInt(match[1], 10);
  }
  return null;
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
