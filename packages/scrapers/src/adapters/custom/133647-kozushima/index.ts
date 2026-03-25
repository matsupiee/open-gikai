/**
 * 神津島村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.kouzushima.tokyo.jp/busyo/gikai/
 * 自治体コード: 133647
 *
 * 神津島村は WordPress サイトで PDF ベースの会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "133647",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pageUrl: m.pageUrl,
        title: m.title,
        year: m.year,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pageUrl: string;
      title: string;
      year: number;
    };
    return fetchMeetingData(
      {
        pageUrl: params.pageUrl,
        title: params.title,
        year: params.year,
      },
      municipalityCode
    );
  },
};
