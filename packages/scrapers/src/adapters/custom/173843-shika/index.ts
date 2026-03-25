/**
 * 志賀町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.shika.lg.jp/site/gikai/list23-19.html
 * 自治体コード: 173843
 *
 * 志賀町は独自 CMS で年度別に PDF を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "173843",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        session: m.session,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      session: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
