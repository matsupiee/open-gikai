import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { fetchMeetingData } from "./detail";
import type { SuttuPdfRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "013927",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(year);

    return records.map((r) => ({
      detailParams: {
        pdfUrl: r.pdfUrl,
        linkText: r.linkText,
        issueNumber: r.issueNumber,
        publishYear: r.publishYear,
        publishMonth: r.publishMonth,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const record = detailParams as unknown as SuttuPdfRecord;
    return fetchMeetingData(record, municipalityId);
  },
};
