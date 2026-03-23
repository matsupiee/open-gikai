/**
 * 神戸町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.godo.gifu.jp/contents/gikai/gikai08.html
 * 自治体コード: 213811
 *
 * 神戸町は自治体 CMS で PDF ベースの議事録を1ページに全年度分公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "213811",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        eraCode: m.eraCode,
        number: m.number,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      eraCode: string;
      number: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
