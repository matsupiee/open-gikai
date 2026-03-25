import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";
import type { ShirosatoListRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "083101",

  async fetchList({ year }): Promise<ListRecord[]> {
    return fetchMeetingList(year);
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as ShirosatoListRecord;
    return fetchMeetingData(params, municipalityCode);
  },
};
