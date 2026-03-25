/**
 * 八郎潟町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.hachirogata.akita.jp/gikai/1001560/index.html
 * 自治体コード: 053635
 *
 * 八郎潟町は自治体 CMS で PDF ベースの議事録を年別ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "053635",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        meetingPageUrl: m.meetingPageUrl,
        meetingId: m.meetingId,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      meetingPageUrl: string;
      meetingId: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
