/**
 * 川棚町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.kawatana.jp/cat05/c5-11/post_267/
 * 自治体コード: 423220
 *
 * 川棚町は公式サイトに年度別で PDF 会議録を掲載しており、
 * 既存の汎用アダプターでは対応できないため、カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { buildMeetingData } from "./detail";
import type { KawatanaMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "423220",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((meeting) => ({
      detailParams: meeting as unknown as Record<string, unknown>,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const meeting = detailParams as unknown as KawatanaMeeting;
    return buildMeetingData(meeting, municipalityId);
  },
};
