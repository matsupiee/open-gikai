/**
 * 小国町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kumamoto-oguni.lg.jp/ogunitowngikai/gikai_kaigiroku
 * 自治体コード: 434248
 *
 * 小国町は町公式サイトで PDF ベースの議事録を単一ページに集約して公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "434248",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        year: m.year,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      year: number;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
