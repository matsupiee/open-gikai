/**
 * 沼田町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.numata.hokkaido.jp/section/gikai/index.html
 * 自治体コード: 014389
 *
 * 沼田町は PDF ファイルで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで議会トップページ → 年度別ページから全 PDF リンクを収集し、
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData, type NumataDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "014389",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        heldOn: doc.heldOn,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
      } satisfies NumataDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as NumataDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
