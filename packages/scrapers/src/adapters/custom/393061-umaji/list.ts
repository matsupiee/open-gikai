/**
 * 馬路村議会 — list フェーズ
 *
 * カテゴリページ（/about/category/parliament/）から投稿ページ URL を収集し、
 * 各投稿ページから PDF リンクと会議情報を抽出する。
 *
 * ページ構造:
 * - カテゴリページ: a[href*="/about/parliament/"] のリンクを収集
 * - 投稿ページ: .entry-content 内の a[href$=".pdf"] を収集
 *   - リンクテキストに会議名（例: 「第1回臨時会（令和7年1月20日）」）が含まれる
 */

import { BASE_ORIGIN, CATEGORY_URL, fetchPage } from "./shared";

export interface UmajiPost {
  /** 投稿ページ URL */
  postUrl: string;
  /** 投稿タイトル */
  postTitle: string;
}

export interface UmajiPdfEntry {
  /** PDF URL */
  pdfUrl: string;
  /** PDF リンクテキスト（会議名・日付を含む） */
  label: string;
  /** 投稿ページ URL（出典として使用） */
  postUrl: string;
  /** 投稿タイトル */
  postTitle: string;
}

/**
 * カテゴリページの HTML から投稿ページリンクを抽出する（テスト可能な純粋関数）。
 *
 * 抽出条件:
 * - href が /about/parliament/{ID}/ 形式のリンク
 * - アンカーテキストから投稿タイトルを取得
 */
export function parseCategoryPage(html: string): UmajiPost[] {
  const results: UmajiPost[] = [];
  const seen = new Set<string>();

  // /about/parliament/{数字}/ 形式のリンクを抽出
  const linkPattern =
    /<a\s[^>]*href="((?:https?:\/\/vill\.umaji\.lg\.jp)?\/about\/parliament\/(\d+)\/)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkPattern)) {
    const href = match[1]!;
    const innerHtml = match[3]!;

    const postUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href}`;

    if (seen.has(postUrl)) continue;
    seen.add(postUrl);

    // リンクテキストをクリーンアップ
    const postTitle = innerHtml
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();

    if (!postTitle) continue;

    results.push({ postUrl, postTitle });
  }

  return results;
}

/**
 * 投稿ページの HTML から PDF リンクを抽出する（テスト可能な純粋関数）。
 *
 * WordPress の wp-content/uploads/ 配下を指す PDF リンクを抽出する。
 * リンクテキストに会議名・日付が含まれる。
 */
export function parsePostPage(
  html: string,
  postUrl: string,
  postTitle: string
): UmajiPdfEntry[] {
  const results: UmajiPdfEntry[] = [];

  // /wp/wp-content/uploads/ 配下の PDF リンクを抽出
  const pdfPattern =
    /<a\s[^>]*href="([^"]*\/wp\/wp-content\/uploads\/[^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pdfPattern)) {
    const href = match[1]!;
    const labelHtml = match[2]!;

    const label = labelHtml
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+/g, " ")
      .trim();

    let pdfUrl: string;
    if (href.startsWith("http")) {
      pdfUrl = href;
    } else if (href.startsWith("/")) {
      pdfUrl = `${BASE_ORIGIN}${href}`;
    } else {
      pdfUrl = `${BASE_ORIGIN}/${href}`;
    }

    results.push({ pdfUrl, label, postUrl, postTitle });
  }

  return results;
}

/**
 * カテゴリページから全 PDF エントリを収集する。
 * カテゴリページ → 各投稿ページ → PDF リンクの3段階でクロールする。
 */
export async function fetchPdfEntries(): Promise<UmajiPdfEntry[]> {
  const categoryHtml = await fetchPage(CATEGORY_URL);
  if (!categoryHtml) return [];

  const posts = parseCategoryPage(categoryHtml);
  const allEntries: UmajiPdfEntry[] = [];

  for (const post of posts) {
    // WordPress サイトへのレート制限を考慮して待機
    await new Promise((r) => setTimeout(r, 1000));

    const postHtml = await fetchPage(post.postUrl);
    if (!postHtml) continue;

    const entries = parsePostPage(postHtml, post.postUrl, post.postTitle);
    allEntries.push(...entries);
  }

  return allEntries;
}
