import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData } from "./detail";
import type { MatsuzakiSessionInfo } from "./list";

export const adapter: ScraperAdapter = {
  name: "223051",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        docId: s.docId,
      } satisfies MatsuzakiSessionInfo,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MatsuzakiSessionInfo;
    return buildMeetingData(params, municipalityCode);
  },
};
