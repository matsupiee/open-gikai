/**
 * 当別町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tobetsu.hokkaido.jp/site/gikai/18717.html
 * 自治体コード: 013030
 *
 * 当別町は自治体公式サイトで PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "013030",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        year: m.year,
        category: m.category,
        pdfKey: m.pdfKey,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      year: number;
      category: string;
      pdfKey: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
