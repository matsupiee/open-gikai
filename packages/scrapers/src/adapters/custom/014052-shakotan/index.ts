/**
 * 積丹町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.shakotan.lg.jp/contents/content0730.html
 * 自治体コード: 014052
 *
 * 積丹町は「会議の結果」（議決結果・一般質問の概要）を PDF で公開しており、
 * 2段階クロール（トップページ → 年度別ページ → PDF）で収集する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type ShakotanDetailParams } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "014052",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(baseUrl, year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
        headingYear: doc.headingYear,
      } satisfies ShakotanDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as ShakotanDetailParams;
    return await buildMeetingData(params, municipalityId);
  },
};
