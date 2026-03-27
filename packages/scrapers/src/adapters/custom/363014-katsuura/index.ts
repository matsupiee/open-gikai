/**
 * 勝浦町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.katsuura.lg.jp/gikai/kaigiroku/
 * 自治体コード: 363014
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";
import type { KatsuuraMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "363014",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);
    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        pageUrl: meeting.pageUrl,
        fiscalYear: meeting.fiscalYear,
        month: meeting.month,
        meetingType: meeting.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const meeting = detailParams as unknown as KatsuuraMeeting;
    return fetchMeetingData(meeting, municipalityCode);
  },
};
