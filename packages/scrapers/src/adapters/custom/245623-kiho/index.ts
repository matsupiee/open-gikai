/**
 * 紀宝町議会 JFIT 映像配信システム — ScraperAdapter 実装
 *
 * サイト: https://kiho-town.stream.jfit.co.jp/
 * 自治体コード: 245623
 *
 * 紀宝町はテキスト形式の会議録を提供していない。
 * 映像配信専用システム（JFIT）であり、現時点ではスクレイピング対象外とする。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "245623",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    return fetchMeetingList(baseUrl, year);
  },

  async fetchDetail({ detailParams, municipalityId }) {
    return fetchMeetingData(detailParams, municipalityId);
  },
};
