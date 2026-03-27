/**
 * 川場村議会 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.kawaba.gunma.jp/kurashi/gikai/kaigiroku/
 * 自治体コード: 104442
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";
import type { KawabaMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "104442",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);
    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        sessionTitle: meeting.sessionTitle,
        meetingType: meeting.meetingType,
        heldOnHint: meeting.heldOnHint,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const meeting = detailParams as unknown as KawabaMeeting;
    return fetchMeetingData(meeting, municipalityCode);
  },
};
