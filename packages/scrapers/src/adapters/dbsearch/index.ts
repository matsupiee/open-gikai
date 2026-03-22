import type { ScraperAdapter, ListRecord } from "../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingDetail } from "./detail";

export {
  fetchMeetingList,
  type DbsearchMeetingRecord,
} from "./list";

export {
  fetchMeetingDetail,
} from "./detail";

export const adapter: ScraperAdapter = {
  name: "dbsearch",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchMeetingList(baseUrl, year);
    if (!records) return [];
    return records.map((r) => ({
      detailParams: {
        detailUrl: r.url,
        meetingId: r.id,
        listTitle: r.title,
        listDate: r.date,
        baseUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { detailUrl, meetingId, listTitle, listDate } = detailParams as {
      detailUrl: string;
      meetingId: string;
      listTitle?: string;
      listDate?: string;
      baseUrl: string;
    };
    return fetchMeetingDetail(detailUrl, municipalityId, meetingId, listTitle, listDate);
  },
};
