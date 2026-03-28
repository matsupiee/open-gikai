import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "394106",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        heldOn: meeting.heldOn,
        issueNumber: meeting.issueNumber,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const meeting = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      issueNumber: number;
    };
    return fetchMeetingData(meeting, municipalityCode);
  },
};
