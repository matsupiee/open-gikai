/**
 * 球磨村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.kumamura.com/list00249.html
 * 自治体コード: 435139
 *
 * 球磨村は独自 CMS で PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "435139",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        kijiId: m.kijiId,
        title: m.title,
        pdfUrls: m.pdfUrls,
        heldOn: m.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      kijiId: string;
      title: string;
      pdfUrls: string[];
      heldOn: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
