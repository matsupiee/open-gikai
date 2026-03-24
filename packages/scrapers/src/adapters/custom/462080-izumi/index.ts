/**
 * 出水市議会 議事録検索システム — ScraperAdapter 実装
 *
 * サイト: https://www.city.kagoshima-izumi.lg.jp/gikai/gijiroku/
 * 自治体コード: 462080
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "462080",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        councilId: meeting.councilId,
        title: meeting.title,
        heldOn: meeting.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { councilId, title, heldOn } = detailParams as {
      councilId: number;
      title: string;
      heldOn: string;
    };
    return fetchMeetingData({ councilId, title, heldOn }, municipalityId);
  },
};
