/**
 * 福智町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.fukuchi.lg.jp/soshiki/jimu/gikai/3596.html
 * 自治体コード: 406104
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "406104",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        meetingType: meeting.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      meetingType: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
