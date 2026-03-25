/**
 * 有田川町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.aridagawa.lg.jp/top/kakuka/gikai/index.html
 * 自治体コード: 303666
 *
 * 有田川町は SMART CMS ベースで PDF 形式の議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "303666",

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

  async fetchDetail({ detailParams, municipalityCode }) {
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
      municipalityCode
    );
  },
};
