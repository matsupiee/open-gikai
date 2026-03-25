/**
 * 共和町教育委員会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kyowa.hokkaido.jp/education/?content=91
 * 自治体コード: 014010
 *
 * 共和町は CMS の content ID ベースで年度別 PDF を公開している。
 * 既存の汎用アダプターでは対応できないため、カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchAllDocuments } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "014010",

  async fetchList({ baseUrl }): Promise<ListRecord[]> {
    const documents = await fetchAllDocuments(baseUrl);

    return documents.map((doc) => ({
      detailParams: {
        pdfUrl: doc.pdfUrl,
        title: doc.title,
        heldOn: doc.heldOn,
        meetingType: "committee",
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const { pdfUrl, title, heldOn, meetingType } = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      meetingType: string;
    };
    return fetchMeetingData({ pdfUrl, title, heldOn, meetingType }, municipalityCode);
  },
};
