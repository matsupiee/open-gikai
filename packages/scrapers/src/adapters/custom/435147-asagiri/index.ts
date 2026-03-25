/**
 * あさぎり町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.asagiri.lg.jp/list00300.html
 * 自治体コード: 435147
 *
 * あさぎり町は独自 CMS で PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "435147",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        kijiId: m.kijiId,
        title: m.title,
        pdfUrl: m.pdfUrl,
        heldOn: m.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      kijiId: string;
      title: string;
      pdfUrl: string;
      heldOn: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
