import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type MasakiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "384011",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        meetingPageId: s.meetingPageId,
      } satisfies MasakiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MasakiDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
