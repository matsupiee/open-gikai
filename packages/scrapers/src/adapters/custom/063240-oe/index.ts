/**
 * 大江町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.oe.yamagata.jp/government/chousei/council/chougikai_kaigiroku/
 * 自治体コード: 063240
 *
 * 大江町議会は独自ページで PDF ベースの会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "063240",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        sessionName: m.sessionName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      sessionName: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
