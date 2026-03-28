import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type KawanishiDetailParams } from "./detail";
import { fetchSessionList } from "./list";

export const adapter: ScraperAdapter = {
  name: "293610",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((session) => ({
      detailParams: {
        title: session.title,
        heldOn: session.heldOn,
        pdfUrl: session.pdfUrl,
        meetingType: session.meetingType,
        pageUrl: session.pageUrl,
        linkLabel: session.linkLabel,
      } satisfies KawanishiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KawanishiDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
