/**
 * 板柳町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.itayanagi.aomori.jp/gikai/teirei/index.html
 * 自治体コード: 023817
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingDetail } from "./detail";

export const adapter: ScraperAdapter = {
  name: "023817",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        pageUrl: meeting.pageUrl,
        sectionIndex: meeting.sectionIndex,
        title: meeting.title,
        heldOn: meeting.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { pageUrl, sectionIndex, title, heldOn } = detailParams as {
      pageUrl: string;
      sectionIndex: number;
      title: string;
      heldOn: string;
    };
    return fetchMeetingDetail({ pageUrl, sectionIndex, title, heldOn, municipalityId });
  },
};
