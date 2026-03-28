/**
 * 東吉野村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.higashiyoshino.lg.jp/
 * 自治体コード: 294535
 *
 * 東吉野村は公式サイト上でテキスト形式の会議録を提供していないため、
 * 現時点では取得対象のレコードは存在しない。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "294535",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    return fetchMeetingList(baseUrl, year);
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    return fetchMeetingData(detailParams, municipalityCode);
  },
};
