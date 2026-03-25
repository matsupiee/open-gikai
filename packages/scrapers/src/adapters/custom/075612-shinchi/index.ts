/**
 * 新地町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: http://shinchi-k.k-quick.net/index.html
 * 自治体コード: 075612
 *
 * 新地町は k-quick.net ドメインで PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "075612",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        yearCode: m.yearCode,
        fileName: m.fileName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      yearCode: string;
      fileName: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
