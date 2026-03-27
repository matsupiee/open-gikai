import type { ListRecord, ScraperAdapter } from "../../adapter";
import type { AssabuDetailParams } from "./detail";
import { buildMeetingData } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "013633",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((document) => ({
      detailParams: {
        title: document.title,
        heldOn: document.heldOn,
        pdfUrl: document.pdfUrl,
        sourceUrl: document.sourceUrl,
        meetingType: document.meetingType,
        pageId: document.pageId,
      } satisfies AssabuDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as AssabuDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
