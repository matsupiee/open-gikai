import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";
import type { MakurazakiMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "462047",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        heldOn: meeting.heldOn,
        meetingType: meeting.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const meeting = detailParams as unknown as MakurazakiMeeting;
    return fetchMeetingData(meeting, municipalityId);
  },
};
