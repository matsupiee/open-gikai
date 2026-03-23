/**
 * 嘉島町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.kumamoto-kashima.lg.jp/q/list/282.html
 * 自治体コード: 434426
 *
 * 嘉島町は公式サイトで PDF を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから記事 ID・タイトル・公開日を収集し、
 * detail フェーズで詳細ページの PDF をダウンロードして発言データを構築する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type KashimaDetailParams } from "./detail";
import { fetchArticleList } from "./list";

export const adapter: ScraperAdapter = {
  name: "434426",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchArticleList(year);

    return records.map((r) => ({
      detailParams: {
        articleId: r.articleId,
        title: r.title,
        detailUrl: r.detailUrl,
        publishedDate: r.publishedDate,
        meetingType: r.meetingType,
      } satisfies KashimaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as KashimaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
