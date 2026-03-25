/**
 * 邑南町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ohnan.lg.jp/www/genre/1000100000201/index.html
 * 自治体コード: 324493
 *
 * 邑南町は公式ウェブサイト内で PDF 形式により会議録を提供しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "324493",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
