/**
 * 嵐山町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ranzan.saitama.jp/category/2-19-9-0-0-0-0-0-0-0.html
 * 自治体コード: 113425
 *
 * 嵐山町は自治体 CMS で年度別・会議種別ごとに PDF を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "113425",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      meetingType: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
