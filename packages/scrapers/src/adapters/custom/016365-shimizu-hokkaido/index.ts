/**
 * 清水町議会（北海道） 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.shimizu.hokkaido.jp/gikai/proceeding/
 * 自治体コード: 016365
 *
 * 清水町（北海道）は自治体公式サイトで HTML ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "016365",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pageUrl: m.pageUrl,
        scheduleUrl: m.scheduleUrl,
        title: m.title,
        heldOn: m.heldOn,
        category: m.category,
        pageKey: m.pageKey,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pageUrl: string;
      scheduleUrl: string;
      title: string;
      heldOn: string | null;
      category: string;
      pageKey: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
