/**
 * 豊前市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.buzen.lg.jp/senkyo-gikai/gikai/gijiroku.html
 * 自治体コード: 402141
 *
 * 豊前市は自治体 CMS で PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "402141",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        detailUrl: m.detailUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      detailUrl: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
