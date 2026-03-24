/**
 * 西予市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.seiyo.ehime.jp/shisei/shigikai/kaigiroku/index.html
 * 自治体コード: 382141
 *
 * 西予市は独自の CMS で PDF 形式の会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "382141",

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

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
