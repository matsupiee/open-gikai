/**
 * 天城町議会 会議録 — ScraperAdapter 実装
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchDocumentList, type AmagiMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "465313",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        heldOn: meeting.heldOn,
        meetingType: meeting.meetingType,
        session: meeting.session,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const meeting = detailParams as unknown as AmagiMeeting;
    return fetchMeetingData(meeting, municipalityCode);
  },
};
