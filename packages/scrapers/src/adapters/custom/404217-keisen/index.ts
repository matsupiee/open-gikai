/**
 * 桂川町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.keisen.fukuoka.jp/gikai/kaigiroku.php
 * 自治体コード: 404217
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList, type KeisenMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "404217",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        title: meeting.title,
        pdfUrl: meeting.pdfUrl,
        heldOn: meeting.heldOn,
        meetingType: meeting.meetingType,
        headingYear: meeting.headingYear,
      } satisfies KeisenMeeting,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const meeting = detailParams as unknown as KeisenMeeting;
    return await fetchMeetingData(meeting, municipalityCode);
  },
};
