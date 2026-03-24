/**
 * 滝川市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.takikawa.lg.jp/page/2872.html
 * 自治体コード: 012254
 *
 * 滝川市は市公式サイト内で PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "012254",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pageId: m.pageId,
        attachmentId: m.attachmentId,
        title: m.title,
        pdfUrl: m.pdfUrl,
        heldOn: m.heldOn,
        isIndex: m.isIndex,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pageId: string;
      attachmentId: string;
      title: string;
      pdfUrl: string;
      heldOn: string | null;
      isIndex: boolean;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
