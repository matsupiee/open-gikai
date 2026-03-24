/**
 * 当麻町議会 会議録 — list フェーズ
 *
 * /parliament/1428 ページから PDF リンクを収集する。
 */

import { BASE_URL, fetchPage } from "./shared";

export const LIST_PAGE_URL = `${BASE_URL}/parliament/1428`;

export interface TohmaDocument {
  /** PDF の絶対 URL */
  pdfUrl: string;
  /** リンクテキスト（例: 令和5年第1回定例会.pdf） */
  linkText: string;
}

/**
 * 一覧ページ HTML から PDF リンクを抽出する。
 * <ul> > <li> > <a href="...pdf"> の構造を想定。
 */
export function parseListPage(html: string): TohmaDocument[] {
  const documents: TohmaDocument[] = [];

  // .pdf で終わる <a> タグを全て抽出
  const anchorRegex = /<a\s[^>]*href="([^"]*\.pdf)"[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorRegex)) {
    const rawHref = match[1]!;
    const rawText = match[2]!.replace(/<[^>]+>/g, "").trim();

    // 相対パスを絶対 URL に変換
    const pdfUrl = rawHref.startsWith("http")
      ? rawHref
      : `${BASE_URL}${rawHref}`;

    // 重複チェック
    if (documents.some((d) => d.pdfUrl === pdfUrl)) continue;

    documents.push({
      pdfUrl,
      linkText: rawText,
    });
  }

  return documents;
}

/**
 * 一覧ページから全 PDF ドキュメント情報を取得する。
 */
export async function fetchAllDocuments(): Promise<TohmaDocument[]> {
  const html = await fetchPage(LIST_PAGE_URL);
  if (!html) return [];
  return parseListPage(html);
}
