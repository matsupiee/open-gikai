/**
 * 洞爺湖町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: http://www.town.toyako.hokkaido.jp/town_administration/town_council/toc006/
 * 自治体コード: 015849
 *
 * 洞爺湖町は自治体公式サイトで PDF 形式の会議録を年度別に公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "015849",

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
