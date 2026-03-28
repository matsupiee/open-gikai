import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";
import type { HigashikushiraMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "464821",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        heldOn: meeting.heldOn,
        meetingType: meeting.meetingType,
        headingYear: meeting.headingYear,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const meeting = detailParams as HigashikushiraMeeting;
    return fetchMeetingData(meeting, municipalityCode);
  },
};
