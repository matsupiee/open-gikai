/**
 * 北竜町議会 — ScraperAdapter 実装
 *
 * サイト: http://www.town.hokuryu.hokkaido.jp/tyousei/gikai/gikaikaigiroku/
 * 自治体コード: 014371
 *
 * 北竜町は PDF ファイルで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでトップページ + 年度別ページから全 PDF リンクを収集し、
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData, type HokuryuDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "014371",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        heldOn: doc.heldOn,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
      } satisfies HokuryuDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as HokuryuDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
