/**
 * 木曽町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town-kiso.com/gikai/
 * 自治体コード: 204323
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchArticleList } from "./list";
import { fetchArticleDetail } from "./detail";
import type { KisoArticle } from "./list";
import type { CategoryId } from "./shared";

export const adapter: ScraperAdapter = {
  name: "204323",

  async fetchList({ year }): Promise<ListRecord[]> {
    const articles = await fetchArticleList(year);

    return articles.map((article) => ({
      detailParams: {
        categoryId: article.categoryId,
        articleId: article.articleId,
        title: article.title,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const { categoryId, articleId, title } = detailParams as {
      categoryId: CategoryId;
      articleId: string;
      title: string;
    };
    const article: KisoArticle & { categoryId: CategoryId } = {
      categoryId,
      articleId,
      title,
    };
    return fetchArticleDetail(article, municipalityCode);
  },
};
