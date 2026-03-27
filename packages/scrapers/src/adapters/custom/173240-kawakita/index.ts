/**
 * 川北町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kawakita.ishikawa.jp/gyosei1/gikai/entry-1027.html
 * 自治体コード: 173240
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";
import type { KawakitaMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "173240",

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
    const meeting = detailParams as unknown as KawakitaMeeting;
    return fetchMeetingData(meeting, municipalityCode);
  },
};
