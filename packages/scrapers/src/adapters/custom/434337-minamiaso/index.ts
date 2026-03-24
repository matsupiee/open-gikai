/**
 * 南阿蘇村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.minamiaso.lg.jp/
 * 自治体コード: 434337
 *
 * 南阿蘇村は村公式サイトで PDF ベースの議事録を年度別ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "434337",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        detailUrl: m.detailUrl,
        kijiId: m.kijiId,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      detailUrl: string;
      kijiId: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
