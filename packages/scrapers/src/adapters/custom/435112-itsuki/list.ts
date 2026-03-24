/**
 * 五木村議会 会議録 — list フェーズ
 *
 * 一覧ページから会議録記事へのリンクを収集する。
 * 「定例会」「臨時会」を含む記事のみ対象とする。
 *
 * autopager による動的読み込みのため、
 * rel="next" を辿って全ページを取得する。
 */

import { BASE_ORIGIN, LIST_URL, fetchPage } from "./shared";

export interface ItsukiListItem {
  /** 記事詳細ページの URL（例: https://www.vill.itsuki.lg.jp/kiji0032032/index.html） */
  articleUrl: string;
  /** リンクテキスト（会議名を含む） */
  title: string;
}

/**
 * 一覧ページ HTML から会議録記事リンクを抽出する。
 * 「定例会」または「臨時会」を含むリンクのみを返す。
 */
export function parseListPage(html: string): {
  items: ItsukiListItem[];
  nextPageUrl: string | null;
} {
  const items: ItsukiListItem[] = [];

  // .loadbox 内の <a href="kiji{ID}/index.html"> リンクを抽出
  // kiji で始まり index.html で終わる相対/絶対リンクを対象とする
  const linkRegex =
    /<a\s+[^>]*href=["']((?:https?:\/\/www\.vill\.itsuki\.lg\.jp\/)?kiji\d+\/index\.html)["'][^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const href = match[1];
    const rawTitle = match[2]
      ?.replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!href || !rawTitle) continue;

    // 「定例会」または「臨時会」を含む記事のみ対象
    if (!rawTitle.includes("定例会") && !rawTitle.includes("臨時会")) continue;

    // 絶対 URL に正規化
    const articleUrl = href.startsWith("http")
      ? href
      : `${BASE_ORIGIN}/${href}`;

    // 重複チェック
    if (items.some((item) => item.articleUrl === articleUrl)) continue;

    items.push({ articleUrl, title: rawTitle });
  }

  // rel="next" で次ページ URL を取得（autopager 用）
  const nextMatch = html.match(/<link\s+[^>]*rel=["']next["'][^>]*href=["']([^"']+)["']/i)
    ?? html.match(/<a\s+[^>]*rel=["']next["'][^>]*href=["']([^"']+)["']/i);

  let nextPageUrl: string | null = null;
  if (nextMatch?.[1]) {
    const href = nextMatch[1];
    nextPageUrl = href.startsWith("http") ? href : `${BASE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
  }

  return { items, nextPageUrl };
}

/**
 * 会議録一覧の全ページを辿り、記事リスト全件を返す。
 */
export async function fetchArticleList(): Promise<ItsukiListItem[]> {
  const allItems: ItsukiListItem[] = [];
  let currentUrl: string | null = LIST_URL;

  while (currentUrl) {
    const html = await fetchPage(currentUrl);
    if (!html) break;

    const { items, nextPageUrl } = parseListPage(html);

    for (const item of items) {
      if (!allItems.some((i) => i.articleUrl === item.articleUrl)) {
        allItems.push(item);
      }
    }

    currentUrl = nextPageUrl;
  }

  return allItems;
}
