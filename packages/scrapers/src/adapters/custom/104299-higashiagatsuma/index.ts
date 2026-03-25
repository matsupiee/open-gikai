/**
 * 東吾妻町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.higashiagatsuma.gunma.jp/www/gikai/genre/1204443645837/index.html
 * 自治体コード: 104299
 *
 * 東吾妻町は自治体 CMS で PDF ベースの議事録を年度別ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "104299",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

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
      heldOn: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
