/**
 * 青木村議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.vill.aoki.nagano.jp/gikai03.html
 * 自治体コード: 203491
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type AokiDetailParams } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "203491",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(baseUrl, year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
      } satisfies AokiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as AokiDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
