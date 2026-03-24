/**
 * 五木村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.itsuki.lg.jp/list00107.html
 * 自治体コード: 435112
 *
 * 五木村は村公式サイトに定例会ごとの会議録を個別記事として直接公開している。
 * 会議録は PDF 形式。autopager による動的読み込みのため、rel="next" を辿って全件取得する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchArticleList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "435112",

  async fetchList(_params): Promise<ListRecord[]> {
    const articles = await fetchArticleList();

    return articles.map((article) => ({
      detailParams: {
        articleUrl: article.articleUrl,
        title: article.title,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { articleUrl } = detailParams as {
      articleUrl: string;
      title: string;
    };
    return fetchMeetingData(articleUrl, municipalityId);
  },
};
