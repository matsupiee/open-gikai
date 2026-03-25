import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData, type MikasaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "012220",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        heldOn: doc.heldOn,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
      } satisfies MikasaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MikasaDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
