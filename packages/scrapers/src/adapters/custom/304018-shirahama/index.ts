import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList, type ShirahamaSessionInfo } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "304018",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        yearPageUrl: s.yearPageUrl,
        meetingType: s.meetingType,
      } satisfies ShirahamaSessionInfo,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as ShirahamaSessionInfo;
    return fetchMeetingData(params, municipalityId);
  },
};
