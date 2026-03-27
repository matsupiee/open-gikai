/**
 * 下市町議会 -- list フェーズ
 *
 * 年別カテゴリページを起点に各会議概要ページの数字 ID を収集する。
 *
 * URL 構造:
 *   年別一覧: /category/1-3-{年コード}-0-0-0-0-0-0-0.html
 *   会議概要: /{数字ID}.html
 *
 * 年コードは YEAR_CODE_MAP で変換する（平成27年と平成28年のコードが逆転している）。
 */

import { BASE_ORIGIN, YEAR_CODE_MAP, fetchPage } from "./shared";

export interface ShimoimchiMeetingRef {
  /** 会議概要ページの URL */
  pageUrl: string;
  /** 数字 ID（例: "1672"） */
  numericId: string;
}

/**
 * 年別カテゴリページから会議概要ページへのリンクを抽出する（純粋関数）。
 *
 * 対象リンクのパターン: /{数字ID}.html （ただし category/ や soshiki/ を含まないもの）
 */
export function parseCategoryPage(html: string): ShimoimchiMeetingRef[] {
  const results: ShimoimchiMeetingRef[] = [];
  const seen = new Set<string>();

  // /{数字ID}.html 形式のリンクを抽出（相対パスと絶対 URL の両方に対応）
  // "category/" や "soshiki/" などを含む URL は除外
  const linkPattern = /href="((?:https?:\/\/[^"]*)?\/(\d+)\.html)"/g;

  for (const match of html.matchAll(linkPattern)) {
    const rawHref = match[1]!;
    const numericId = match[2]!;

    if (seen.has(numericId)) continue;
    seen.add(numericId);

    // 絶対 URL の場合はそのまま使用、相対パスの場合は BASE_ORIGIN を付加
    const pageUrl = rawHref.startsWith("http")
      ? rawHref
      : `${BASE_ORIGIN}${rawHref}`;

    results.push({
      pageUrl,
      numericId,
    });
  }

  return results;
}

/**
 * 指定年の会議概要ページ参照一覧を取得する。
 */
export async function fetchMeetingRefs(
  _baseUrl: string,
  year: number
): Promise<ShimoimchiMeetingRef[]> {
  const yearCode = YEAR_CODE_MAP[year];
  if (!yearCode) return [];

  const categoryUrl = `${BASE_ORIGIN}/category/1-3-${yearCode}-0-0-0-0-0-0-0.html`;
  const html = await fetchPage(categoryUrl);
  if (!html) return [];

  return parseCategoryPage(html);
}
