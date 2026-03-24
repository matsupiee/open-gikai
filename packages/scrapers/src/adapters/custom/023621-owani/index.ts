/**
 * 大鰐町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/
 * 自治体コード: 023621
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "023621",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        title: m.title,
        heldOn: m.heldOn,
        pdfUrl: m.pdfUrl,
        fileKey: m.fileKey,
        yearPageUrl: m.yearPageUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      title: string;
      heldOn: string;
      pdfUrl: string;
      fileKey: string;
      yearPageUrl: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
