/**
 * 八女市議会（福岡県） 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.yame.fukuoka.jp/shisei/12/7/index.html
 * 自治体コード: 402109
 *
 * 八女市は独自 CMS で PDF ベースの議事録を各会議ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "402109",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
        pageUrl: m.pageUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      meetingType: string;
      pageUrl: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
