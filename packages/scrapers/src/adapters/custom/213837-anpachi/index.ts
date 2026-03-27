import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "213837",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);
    return meetings.map((meeting) => ({
      detailParams: {
        detailUrl: meeting.detailUrl,
        title: meeting.title,
        pageId: meeting.pageId,
        pdfUrl: meeting.pdfUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      detailUrl: string;
      title: string;
      pageId: string;
      pdfUrl: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
