/**
 * 岩手町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://town.iwate.iwate.jp/gikai/minutes/search-minutes/
 * 自治体コード: 033031
 *
 * 岩手町は NTT アドバンステクノロジ製 DiscussNet SSP（ssp.kaigiroku.net）を
 * 外部システムとして利用しており、REST API 経由でデータを取得する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";
import type { IwateListRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "033031",

  async fetchList({ year }): Promise<ListRecord[]> {
    return fetchMeetingList(year);
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as IwateListRecord;
    return fetchMeetingData(params, municipalityId);
  },
};
