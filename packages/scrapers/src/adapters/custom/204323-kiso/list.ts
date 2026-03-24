/**
 * 木曽町議会 — list フェーズ
 *
 * 各カテゴリ一覧ページを巡回し、記事 URL を収集する。
 */

import {
  type CategoryId,
  CATEGORY_IDS,
  buildCategoryUrl,
  fetchPage,
} from "./shared";

export interface KisoArticle {
  /** カテゴリ ID */
  categoryId: CategoryId;
  /** 記事 ID（数値文字列） */
  articleId: string;
  /** 記事タイトル */
  title: string;
}

/**
 * カテゴリ一覧ページの HTML から記事リンクをパースする。
 * `<h3><a href="/gikai/kekka/{categoryId}/{articleId}/">タイトル</a></h3>` 形式を抽出する。
 */
export function parseCategoryPage(
  html: string,
  categoryId: CategoryId,
): { articles: KisoArticle[]; hasNextPage: boolean } {
  const articles: KisoArticle[] = [];

  // <h3> 内のリンクを抽出
  const linkRegex =
    /<h3[^>]*>\s*<a[^>]+href=["']\/gikai\/kekka\/(\d+)\/(\d+)\/["'][^>]*>([^<]+)<\/a>\s*<\/h3>/gi;

  for (const match of html.matchAll(linkRegex)) {
    const catId = match[1];
    const articleId = match[2];
    const rawTitle = match[3];
    if (!catId || !articleId || !rawTitle) continue;
    if (catId !== categoryId) continue;

    articles.push({
      categoryId,
      articleId,
      title: rawTitle.trim().replace(/\s+/g, " "),
    });
  }

  // 「次のページへ」リンクが href を持つかで次ページ有無を判定
  // 非活性の場合は href="#" または href が空
  const hasNextPage = /href=["']\/gikai\/kekka\/\d+\/\?page=\d+["']/.test(html) &&
    /次のページへ/.test(html) &&
    !/<a[^>]+href=["']#["'][^>]*>\s*次のページへ/.test(html);

  return { articles, hasNextPage };
}

/**
 * 指定カテゴリの全ページを巡回して記事一覧を取得する。
 */
export async function fetchCategoryArticles(
  categoryId: CategoryId,
): Promise<KisoArticle[]> {
  const allArticles: KisoArticle[] = [];
  let page = 1;

  while (true) {
    const url = buildCategoryUrl(categoryId, page);
    const html = await fetchPage(url);
    if (!html) break;

    const { articles, hasNextPage } = parseCategoryPage(html, categoryId);
    allArticles.push(...articles);

    if (!hasNextPage) break;
    page++;
  }

  return allArticles;
}

/**
 * 全角数字を半角数字に変換する。
 * 例: "６" → "6"
 */
function normalizeDigits(str: string): string {
  return str.replace(/[０-９]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xff10 + 0x30),
  );
}

/**
 * タイトルから令和の年数（半角整数）を抽出する。
 * 全角・半角の両方に対応する。
 * 令和表記がない場合は null を返す。
 */
function extractReiwaYear(title: string): number | null {
  const normalized = normalizeDigits(title);
  const match = normalized.match(/令和\s*(\d+)\s*年/);
  if (!match?.[1]) return null;
  return parseInt(match[1], 10);
}

/**
 * 指定年の記事を全カテゴリから収集する。
 * タイトルに含まれる年度情報で絞り込む。
 * 全角・半角数字の両方に対応する。
 */
export async function fetchArticleList(year: number): Promise<KisoArticle[]> {
  const allArticles: KisoArticle[] = [];
  const reiwaYear = year - 2018;

  for (const categoryId of CATEGORY_IDS) {
    const articles = await fetchCategoryArticles(categoryId);

    const filtered = articles.filter((a) => {
      const title = a.title;
      const normalized = normalizeDigits(title);

      // 令和X年 が含まれる場合は年数で絞り込み
      if (normalized.includes("令和")) {
        const ry = extractReiwaYear(title);
        if (ry !== null) return ry === reiwaYear;
        // 令和 があるが年数が取れない場合はスキップ
        return false;
      }

      // 平成・昭和の場合（西暦に換算）
      const heiseiMatch = normalized.match(/平成\s*(\d+)\s*年/);
      if (heiseiMatch?.[1]) {
        return 1988 + parseInt(heiseiMatch[1], 10) === year;
      }

      // 4桁西暦年が含まれる場合
      const seirekiMatch = normalized.match(/(\d{4})年/);
      if (seirekiMatch?.[1]) {
        return parseInt(seirekiMatch[1], 10) === year;
      }

      // 年度情報がないタイトルはスキップ
      return false;
    });

    allArticles.push(...filtered);
  }

  return allArticles;
}
