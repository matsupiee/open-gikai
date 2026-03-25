/**
 * 浦河町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.urakawa.hokkaido.jp/gyosei/council/
 * 自治体コード: 016071
 *
 * 浦河町は自治体公式サイトで PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "016071",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        category: m.category,
        pdfKey: m.pdfKey,
        contentId: m.contentId,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      category: string;
      pdfKey: string;
      contentId: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
