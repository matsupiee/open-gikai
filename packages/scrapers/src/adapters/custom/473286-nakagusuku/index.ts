import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";
import type { NakagusukuListRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "473286",

  async fetchList({ year }): Promise<ListRecord[]> {
    return fetchMeetingList(year);
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as NakagusukuListRecord;
    return fetchMeetingData(params, municipalityCode);
  },
};
