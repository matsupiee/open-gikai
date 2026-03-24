/**
 * 北川村議会 — list フェーズ
 *
 * 議会カテゴリ一覧ページから議会事務局担当の定例会・臨時会記事リンクを収集する。
 *
 * ページ構造:
 * - div.list > p > a: 記事リンク
 *   - span[0]: タイトル
 *   - span[1]: 担当課・掲載日などのメタ情報
 * - 議会事務局担当かつタイトルに「定例会」or「臨時会」を含む記事を対象とする
 */

import { BASE_ORIGIN, LIST_URL, fetchPage } from "./shared";

export interface KitagawaArticle {
  /** 詳細ページのキー（hdnKey パラメータ） */
  hdnKey: string;
  /** 記事タイトル */
  title: string;
  /** 詳細ページ URL */
  detailUrl: string;
}

/**
 * 一覧ページの HTML から議会関連記事を抽出する（テスト可能な純粋関数）。
 *
 * 抽出条件:
 * - meta に「議会事務局」を含む
 * - タイトルに「定例会」または「臨時会」を含む
 */
export function parseListPage(html: string): KitagawaArticle[] {
  const results: KitagawaArticle[] = [];

  // div.list 内の p > a を抽出
  // href が /life/dtl.php?hdnKey={ID} のリンク
  const linkPattern =
    /<a\s+href="(\/life\/dtl\.php\?hdnKey=(\d+))"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const hdnKey = match[2]!;
    const innerHtml = match[3]!;

    // span 要素からテキストを抽出
    const spans: string[] = [];
    const spanPattern = /<span[^>]*>([\s\S]*?)<\/span>/gi;
    for (const spanMatch of innerHtml.matchAll(spanPattern)) {
      const text = spanMatch[1]!
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
      spans.push(text);
    }

    if (spans.length < 2) continue;

    const title = spans[0]!.replace(/\s+/g, " ").trim();
    const meta = spans[1]!;

    // 議会事務局担当かつ定例会・臨時会を含む記事のみ対象
    if (!meta.includes("議会事務局")) continue;
    if (!/定例会|臨時会/.test(title)) continue;

    const detailUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    results.push({ hdnKey, title, detailUrl });
  }

  return results;
}

/**
 * 一覧ページから議会関連記事を取得する。
 */
export async function fetchArticleList(): Promise<KitagawaArticle[]> {
  const html = await fetchPage(LIST_URL);
  if (!html) return [];

  return parseListPage(html);
}
