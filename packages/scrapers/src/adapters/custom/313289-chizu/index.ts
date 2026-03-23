/**
 * 智頭町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www1.town.chizu.tottori.jp/chizu/gikaijimukyoku/gijiroku/
 * 自治体コード: 313289
 *
 * 智頭町は町公式サイトで年度別 PDF を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "313289",

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
      heldOn: string;
      meetingType: string;
    };
    return fetchMeetingData(
      {
        pdfUrl: params.pdfUrl,
        title: params.title,
        heldOn: params.heldOn,
        meetingType: params.meetingType,
      },
      municipalityId,
    );
  },
};
