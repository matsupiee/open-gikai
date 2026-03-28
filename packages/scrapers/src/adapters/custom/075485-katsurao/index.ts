/**
 * 葛尾村議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.katsurao.org/site/gikai/
 * 自治体コード: 075485
 *
 * 葛尾村は会議録本文を公開しておらず、会議結果ページの HTML テーブルで
 * 議決事項を公開している。本アダプターではその議決一覧を statement として保存する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData, type KatsuraoDetailParams } from "./detail";
import { fetchMeetingRefs } from "./list";

export const adapter: ScraperAdapter = {
  name: "075485",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const refs = await fetchMeetingRefs(baseUrl, year);

    return refs.map((ref) => ({
      detailParams: {
        pageUrl: ref.pageUrl,
        articleTitle: ref.articleTitle,
      } satisfies KatsuraoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KatsuraoDetailParams;
    return fetchMeetingData(params, municipalityCode);
  },
};
