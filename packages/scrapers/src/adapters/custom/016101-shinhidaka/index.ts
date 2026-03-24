/**
 * 新ひだか町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.shinhidaka-hokkaido.jp/gikai/detail/00000185.html
 * 自治体コード: 016101
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "016101",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        sourceUrl: m.sourceUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
        externalId: m.externalId,
        format: m.format,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      sourceUrl: string;
      title: string;
      heldOn: string | null;
      meetingType: string;
      externalId: string;
      format: "html" | "pdf";
    };
    return fetchMeetingData(params, municipalityId);
  },
};
