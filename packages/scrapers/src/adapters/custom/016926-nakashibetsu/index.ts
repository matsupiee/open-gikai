/**
 * 中標津町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.nakashibetsu.jp/gikai/
 * 自治体コード: 016926
 *
 * 中標津町は一般質問・意見書を PDF 形式で公開しており、
 * 会議録検索システムは未導入のためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "016926",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        year: m.year,
        month: m.month,
        sessionName: m.sessionName,
        sessionCode: m.sessionCode,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      year: number;
      month: number;
      sessionName: string;
      sessionCode: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
