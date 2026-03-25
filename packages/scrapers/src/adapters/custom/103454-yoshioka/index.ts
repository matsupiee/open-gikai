/**
 * 吉岡町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.yoshioka.lg.jp/gikai/kaigiroku/
 * 自治体コード: 103454
 *
 * 吉岡町は全ての会議録を PDF で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "103454",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        title: m.title,
        pdfUrl: m.pdfUrl,
        heldOn: m.heldOn,
        sourceUrl: m.sourceUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      title: string;
      pdfUrl: string;
      heldOn: string | null;
      sourceUrl: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
