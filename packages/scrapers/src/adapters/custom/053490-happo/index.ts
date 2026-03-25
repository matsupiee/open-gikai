/**
 * 八峰町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.happo.lg.jp/genre/kurashi/ghosei/gikai/gijiroku
 * 自治体コード: 053490
 *
 * 八峰町は自治体 CMS で PDF ベースの議事録を年度別ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "053490",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        section: m.section,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      section: string;
    };
    return fetchMeetingData(
      { pdfUrl: params.pdfUrl, title: params.title, section: params.section },
      municipalityCode,
    );
  },
};
