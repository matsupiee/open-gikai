/**
 * 鏡石町議会 DiscussVision Smart — ScraperAdapter 実装
 *
 * サイト: https://smart.discussvision.net/smart/tenant/kagamiishi/WebView/rd/council_1.html
 * 自治体コード: 073423
 */

import type { ScraperAdapter } from "../../adapter";
import { fetchKagamiishiList } from "./list";
import { buildMeetingData } from "./detail";
import type { KagamiishiListRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "073423",

  async fetchList({ year }) {
    return fetchKagamiishiList(year);
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const record = detailParams as unknown as KagamiishiListRecord;
    return buildMeetingData(record, municipalityId);
  },
};
