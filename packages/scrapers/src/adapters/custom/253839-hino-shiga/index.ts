import type { ScraperAdapter, ListRecord } from "../../adapter";
import { buildMeetingData, type HinoShigaDetailParams } from "./detail";
import { fetchMeetingRecords } from "./list";

export const adapter: ScraperAdapter = {
  name: "253839",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchMeetingRecords(year);

    return records.map((record) => ({
      detailParams: {
        sessionTitle: record.sessionTitle,
        pdfUrl: record.pdfUrl,
        linkText: record.linkText,
        meetingType: record.meetingType,
        heldOn: record.heldOn,
        detailPageUrl: record.detailPageUrl,
      } satisfies HinoShigaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as HinoShigaDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
