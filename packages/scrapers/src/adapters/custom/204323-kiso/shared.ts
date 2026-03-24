/**
 * 木曽町議会 — 共通ユーティリティ
 *
 * サイト: https://www.town-kiso.com/gikai/
 */

export const BASE_ORIGIN = "https://www.town-kiso.com";

const USER_AGENT =
  "open-gikai-bot/1.0 (https://github.com/matsupiee/open-gikai; contact: please see github)";

const FETCH_TIMEOUT_MS = 30_000;

/**
 * スクレイピング対象のカテゴリ ID 一覧。
 * 100414（一般質問録画動画）は動画コンテンツのため対象外。
 */
export const CATEGORY_IDS = [
  "100238", // 議案
  "100237", // 請願・陳情及び意見書
  "100312", // 議決結果
  "100413", // 一般質問
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

/** カテゴリ ID から日本語名称を返す */
export function getCategoryName(categoryId: CategoryId): string {
  const names: Record<CategoryId, string> = {
    "100238": "議案",
    "100237": "請願・陳情及び意見書",
    "100312": "議決結果",
    "100413": "一般質問",
  };
  return names[categoryId];
}

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
    console.warn(`[kiso] fetchPage failed: ${url}`, e);
    return null;
  }
}

/** fetch してバイナリを返す */
export async function fetchBinary(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    console.warn(`[kiso] fetchBinary failed: ${url}`, e);
    return null;
  }
}

/**
 * カテゴリ一覧ページの URL を組み立てる。
 */
export function buildCategoryUrl(categoryId: CategoryId, page = 1): string {
  if (page <= 1) {
    return `${BASE_ORIGIN}/gikai/kekka/${categoryId}/`;
  }
  return `${BASE_ORIGIN}/gikai/kekka/${categoryId}/?page=${page}`;
}

/**
 * 記事詳細ページの URL を組み立てる。
 */
export function buildArticleUrl(categoryId: CategoryId, articleId: string): string {
  return `${BASE_ORIGIN}/gikai/kekka/${categoryId}/${articleId}/`;
}

/**
 * 会議タイプを判別する。
 */
export function detectMeetingType(title: string): string {
  if (title.includes("委員会")) return "committee";
  if (title.includes("臨時会")) return "extraordinary";
  return "plenary";
}

/**
 * 「令和X年Y月」のような和暦文字列を YYYY-MM-DD に変換する。
 * 変換できない場合は null を返す。
 */
export function parseJapaneseDate(text: string): string | null {
  // 令和/平成/昭和 + 年月（日は任意）
  const reiwa = text.match(/令和\s*(\d+)\s*年\s*(\d+)\s*月(?:\s*(\d+)\s*日)?/);
  if (reiwa) {
    const year = 2018 + parseInt(reiwa[1]!, 10);
    const month = parseInt(reiwa[2]!, 10).toString().padStart(2, "0");
    const day = reiwa[3] ? parseInt(reiwa[3], 10).toString().padStart(2, "0") : "01";
    return `${year}-${month}-${day}`;
  }

  const heisei = text.match(/平成\s*(\d+)\s*年\s*(\d+)\s*月(?:\s*(\d+)\s*日)?/);
  if (heisei) {
    const year = 1988 + parseInt(heisei[1]!, 10);
    const month = parseInt(heisei[2]!, 10).toString().padStart(2, "0");
    const day = heisei[3] ? parseInt(heisei[3], 10).toString().padStart(2, "0") : "01";
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD 形式
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  return null;
}
