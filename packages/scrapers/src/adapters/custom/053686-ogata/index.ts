/**
 * 大潟村議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.vill.ogata.akita.jp/genre/parliament/minutes
 * 自治体コード: 053686
 *
 * 大潟村は自治体 CMS で PDF ベースの議事録を一覧ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "053686",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        detailUrl: m.detailUrl,
        title: m.title,
        pdfUrl: m.pdfUrl,
        committeePdfUrls: m.committeePdfUrls,
        meetingId: m.meetingId,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      detailUrl: string;
      title: string;
      pdfUrl: string;
      committeePdfUrls: string[];
      meetingId: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
