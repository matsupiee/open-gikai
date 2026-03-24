/**
 * 矢掛町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: http://www.town.yakage.okayama.jp/gikaikaigiroku.html
 * 自治体コード: 334618
 *
 * 矢掛町は PDF ベースの議事録を単一ページに全年度分掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "334618",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingKind: m.meetingKind,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      meetingKind: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
