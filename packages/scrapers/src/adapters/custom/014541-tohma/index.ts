/**
 * 当麻町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tohma.hokkaido.jp/parliament
 * 自治体コード: 014541
 *
 * 当麻町は Drupal CMS による PDF 公開形式のため、
 * 既存の汎用アダプターでは対応できないカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchAllDocuments } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "014541",

  async fetchList(_params): Promise<ListRecord[]> {
    const documents = await fetchAllDocuments();

    return documents.map((doc) => ({
      detailParams: {
        pdfUrl: doc.pdfUrl,
        linkText: doc.linkText,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const { pdfUrl, linkText } = detailParams as {
      pdfUrl: string;
      linkText: string;
    };
    return fetchMeetingData({ pdfUrl, linkText }, municipalityCode);
  },
};
