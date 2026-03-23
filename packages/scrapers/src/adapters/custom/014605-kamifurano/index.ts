/**
 * 上富良野町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kamifurano.hokkaido.jp/index.php?id=114
 * 自治体コード: 014605
 *
 * 上富良野町は独自 CMS による PDF 公開形式のため、
 * 既存の汎用アダプターでは対応できないカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchAllDocuments } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "014605",

  async fetchList(_params): Promise<ListRecord[]> {
    const documents = await fetchAllDocuments();

    return documents.map((doc) => ({
      detailParams: {
        pdfUrl: doc.pdfUrl,
        title: doc.title,
        rawDate: doc.rawDate,
        meetingType: doc.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { pdfUrl, title, rawDate, meetingType } = detailParams as {
      pdfUrl: string;
      title: string;
      rawDate: string | null;
      meetingType: string;
    };
    return fetchMeetingData({ pdfUrl, title, rawDate, meetingType }, municipalityId);
  },
};
