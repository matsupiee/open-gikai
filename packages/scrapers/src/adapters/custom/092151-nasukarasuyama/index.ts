/**
 * 那須烏山市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.nasukarasuyama.lg.jp/city-council/minutes/index.html
 * 自治体コード: 092151
 *
 * 那須烏山市は市公式サイトに PDF 形式で会議録を直接掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "092151",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        pdfId: m.pdfId,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      pdfId: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
