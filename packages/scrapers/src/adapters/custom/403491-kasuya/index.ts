import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "403491",

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
    const params = detailParams as KasuyaDetailParams;
    return fetchMeetingData(params, municipalityCode);
  },
};

type KasuyaDetailParams = {
  pdfUrl: string;
  title: string;
  meetingType: "plenary" | "extraordinary" | "committee";
};
