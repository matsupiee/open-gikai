/**
 * 北川村議会 — list フェーズ
 *
 * 議会カテゴリ一覧ページから議会事務局担当の定例会・臨時会記事リンクを収集する。
 *
 * ページ構造:
 * - div.list > p > a: 記事リンク
 *   - <a> 内にタグなしのプレーンテキストで「タイトル 担当課 掲載日」が並ぶ
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
 * - 本文テキストに「議会事務局」を含む
 * - タイトルに「定例会」または「臨時会」を含む
 *
 * 実際のページでは <a> 内に <span> がなく、テキストが直接書かれている。
 * innerHTML 全体からタグを除去してテキストを取得し、担当課と
 * 「定例会」「臨時会」をチェックする。
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

    // タグを除去してプレーンテキストを取得
    const fullText = innerHtml
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();

    // 議会事務局担当かつ定例会・臨時会を含む記事のみ対象
    if (!fullText.includes("議会事務局")) continue;
    if (!/定例会|臨時会/.test(fullText)) continue;

    // タイトルはテキスト全体の先頭部分（最初の区切り文字より前）
    // 実際のテキスト例: "第○回定例会 議会事務局 2021-XX-XX"
    // スペース区切りの最初のトークンではなく、担当課・日付より前を取る
    // シンプルに fullText をタイトルとして使う（詳細ページで正確な値が取れる）
    const title = fullText;

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
