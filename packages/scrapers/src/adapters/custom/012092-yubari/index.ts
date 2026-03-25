import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData, type YubariDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "012092",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        heldOn: doc.heldOn,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
      } satisfies YubariDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as YubariDetailParams;
    return await buildMeetingData(params, municipalityId);
  },
};
