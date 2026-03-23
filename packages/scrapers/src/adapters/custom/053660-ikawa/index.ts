/**
 * 井川町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ikawa.akita.jp/site/gikai/
 * 自治体コード: 053660
 *
 * 井川町は CMS による議会だより PDF 公開（会議録検索システムなし）。
 * 議会だより一覧ページから PDF URL を収集し、PDF テキストを解析する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "053660",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

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
      month: number;
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
