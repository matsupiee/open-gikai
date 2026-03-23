/**
 * 五霞町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.goka.lg.jp/kurashi-machi-shigoto/gyousei/gyousei-notice/gikai/shingikeeka-kaigiroku/
 * 自治体コード: 085421
 *
 * 五霞町は町独自ページで会議録 PDF を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "085421",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        title: m.title,
        pageUrl: m.pageUrl,
        pdfUrls: m.pdfUrls,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      title: string;
      pageUrl: string;
      pdfUrls: string[];
    };
    return fetchMeetingData(params, municipalityId);
  },
};
