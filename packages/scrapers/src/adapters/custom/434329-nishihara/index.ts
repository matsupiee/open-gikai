/**
 * 西原村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.nishihara.kumamoto.jp/gikai/list00557.html
 * 自治体コード: 434329
 *
 * 西原村は村公式サイト内で PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "434329",

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

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      kijiId: string;
      title: string;
      pdfUrl: string;
      heldOn: string | null;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
