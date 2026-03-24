/**
 * 平内町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.hiranai.aomori.jp/soshiki/gikai/1/1/594.html
 * 自治体コード: 023019
 *
 * 平内町は SMART CMS で PDF ベースの会議録を単一ページに全年度分まとめて公開しており、
 * 既存の汎用アダプターでは対応できないため、カスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "023019",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        year: m.year,
        month: m.month,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      year: number;
      month: number | null;
    };
    return fetchMeetingData(
      {
        pdfUrl: params.pdfUrl,
        title: params.title,
        year: params.year,
        month: params.month,
      },
      municipalityId,
    );
  },
};
