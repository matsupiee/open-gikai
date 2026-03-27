import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "075043",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        heldOn: meeting.heldOn,
        sessionName: meeting.sessionName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      sessionName: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
