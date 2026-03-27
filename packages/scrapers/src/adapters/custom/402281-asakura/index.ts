/**
 * 朝倉市議会（福岡県） 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.asakura.lg.jp/www/genre/1000000000015/index.html
 * 自治体コード: 402281
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "402281",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        heldOn: meeting.heldOn,
        meetingType: meeting.meetingType,
        pageUrl: meeting.pageUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      meetingType: "plenary" | "extraordinary" | "committee";
      pageUrl: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
