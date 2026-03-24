/**
 * 湯浅町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.yuasa.wakayama.jp/site/gikai/
 * 自治体コード: 303615
 *
 * 湯浅町は汎用 CMS ベースで PDF 形式の議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "303615",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
        detailPageUrl: m.detailPageUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      meetingType: string;
      detailPageUrl: string;
    };
    return fetchMeetingData(
      {
        pdfUrl: params.pdfUrl,
        title: params.title,
        heldOn: params.heldOn,
        meetingType: params.meetingType,
        detailPageUrl: params.detailPageUrl,
      },
      municipalityId
    );
  },
};
