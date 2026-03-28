import type { ListRecord, ScraperAdapter } from "../../adapter";
import type { FukushimaMeeting } from "./list";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "013323",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);
    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        heldOn: meeting.heldOn,
        meetingType: meeting.meetingType,
      } satisfies FukushimaMeeting,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    return fetchMeetingData(detailParams as unknown as FukushimaMeeting, municipalityCode);
  },
};
