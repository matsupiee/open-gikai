/**
 * 能登町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/index.html
 * 自治体コード: 174637
 *
 * 能登町は町公式サイトで年度別に PDF を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "174637",

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
