import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";
import type { MinamiListRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "363871",

  async fetchList({ year }): Promise<ListRecord[]> {
    return fetchMeetingList(year);
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MinamiListRecord;
    return fetchMeetingData(params, municipalityCode);
  },
};
