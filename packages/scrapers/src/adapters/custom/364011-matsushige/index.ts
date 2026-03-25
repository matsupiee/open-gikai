import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { buildMeetingData, toDetailParams, type MatsushigeDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "364011",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(year);

    return records.map((r) => {
      const params = toDetailParams(r);
      return {
        detailParams: {
          title: params.title,
          heldOn: params.heldOn,
          pdfUrl: params.pdfUrl,
          meetingType: params.meetingType,
        } satisfies MatsushigeDetailParams,
      };
    });
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MatsushigeDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
