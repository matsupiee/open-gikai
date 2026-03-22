import type { ScraperAdapter, ListRecord } from "../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingDetail } from "./detail";

export {
  fetchMeetingList,
  parseListHtml,
  type GijirokuMeetingRecord,
} from "./list";

export {
  fetchMeetingDetail,
  extractStatementFromHuidPage,
  parseSidebarHuids,
  extractDateFromContent,
  detectMeetingType,
  classifyKind,
  extractStatements,
} from "./detail";

export const adapter: ScraperAdapter = {
  name: "gijiroku_com",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchMeetingList(baseUrl, year);
    if (!records) return [];
    return records.map((r) => ({
      detailParams: {
        baseUrl,
        fino: r.fino,
        kgno: r.kgno,
        unid: r.unid,
        title: r.title,
        dateLabel: r.dateLabel,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { baseUrl, fino, unid, title, dateLabel } = detailParams as {
      baseUrl: string;
      fino: string;
      kgno: string;
      unid: string;
      title: string;
      dateLabel: string;
    };
    return fetchMeetingDetail(baseUrl, fino, municipalityId, unid, title, dateLabel);
  },
};
