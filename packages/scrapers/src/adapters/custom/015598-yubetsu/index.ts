/**
 * 湧別町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.yubetsu.lg.jp/administration/town/detail.html?content=516
 * 自治体コード: 015598
 *
 * 湧別町は自治体公式サイトの単一ページに PDF リンクを掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "015598",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      meetingType: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
