/**
 * 上関町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kaminoseki.lg.jp/
 * 自治体コード: 353418
 *
 * 会議録ページ（https://www.town.kaminoseki.lg.jp/上関町議会　議事録.html）は
 * 2026年3月時点で HTTP 404 エラーのため、スクレイピング対象外。
 * 会議録ページが復旧次第、list.ts および detail.ts に実装を追加すること。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "353418",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        title: m.title,
        heldOn: m.heldOn,
        url: m.url,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      title: string;
      heldOn: string;
      url: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
