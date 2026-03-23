/**
 * 北広島町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town.kitahiroshima.lg.jp/site/gikai/list98.html
 */

export const BASE_ORIGIN = "https://www.town.kitahiroshima.lg.jp";

/** 会議録トップページ URL */
export const TOP_PAGE_URL = `${BASE_ORIGIN}/site/gikai/list98.html`;

/** バックナンバーページ URL（平成27年〜令和3年） */
export const BACKNUM_PAGE_URL = `${BASE_ORIGIN}/site/gikai/list98-325.html`;

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/** fetch して UTF-8 テキストを返す。失敗時は null */
export async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.warn(`[kitahiroshima-town] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリ（ArrayBuffer）を返す。失敗時は null */
export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch (e) {
    console.warn(`[kitahiroshima-town] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/**
 * 和暦テキストを YYYY-MM-DD 形式に変換する。
 * 例: "令和6年1月30日" → "2024-01-30"
 * 解析できない場合は null を返す。
 */
export function parseJapaneseDate(text: string): string | null {
  const match = text.match(/(?:(令和|平成)(\d+)年(\d+)月(\d+)日)/);
  if (!match) return null;

  const era = match[1];
  const year = parseInt(match[2]!, 10);
  const month = parseInt(match[3]!, 10);
  const day = parseInt(match[4]!, 10);

  let westernYear: number;
  if (era === "令和") {
    westernYear = 2018 + year;
  } else if (era === "平成") {
    westernYear = 1988 + year;
  } else {
    return null;
  }

  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${westernYear}-${mm}-${dd}`;
}

/**
 * セクション見出しテキストから会議種別文字列を返す。
 * 例: "令和6年第1回定例会" → "plenary"
 *     "令和6年第2回臨時会" → "extraordinary"
 */
export function detectMeetingType(sectionTitle: string): string {
  if (sectionTitle.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * セクション見出しテキストから回次文字列を抽出する。
 * 例: "令和6年第1回定例会" → "第1回定例会"
 * 抽出できない場合は元のテキストをそのまま返す。
 */
export function extractSessionLabel(sectionTitle: string): string {
  const match = sectionTitle.match(/第\d+回(?:定例会|臨時会)/);
  return match ? match[0] : sectionTitle;
}
