/**
 * 上勝町議会 -- ScraperAdapter 実装
 *
 * サイト: http://www.kamikatsu.jp/gikai/
 * 自治体コード: 363022
 *
 * 上勝町は Joruri CMS を使用した公式サイト内で議決書・議会だよりを
 * PDF 形式で公開している。テキスト形式の会議録（発言録）は存在しない。
 * TLS 証明書に問題があるため HTTP でアクセスする。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchArticleList } from "./list";
import { buildMeetingData, type KamikatsuDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "363022",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const articles = await fetchArticleList(baseUrl, year);

    return articles.map((a) => ({
      detailParams: {
        title: a.title,
        publishedOn: a.publishedOn,
        pdfUrl: a.pdfUrl,
        meetingType: a.meetingType,
        articleId: a.articleId,
        category: a.category,
      } satisfies KamikatsuDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KamikatsuDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
