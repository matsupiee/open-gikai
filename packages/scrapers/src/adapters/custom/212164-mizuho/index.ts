/**
 * 瑞穂市議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.city.mizuho.lg.jp/3412.htm
 * 自治体コード: 212164
 *
 * 瑞穂市は PDF ファイルで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度ページ → 会議ページ → PDF リンクの 3 段階クロールを行い、
 * detail フェーズで PDF をダウンロードしてテキスト抽出・発言パースを行う。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type MizuhoDetailParams } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "212164",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
        heldOn: doc.heldOn,
        sessionTitle: doc.sessionTitle,
      } satisfies MizuhoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as MizuhoDetailParams;
    return await buildMeetingData(params, municipalityId);
  },
};
