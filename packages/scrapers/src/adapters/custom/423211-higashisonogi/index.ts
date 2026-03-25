/**
 * 東彼杵町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.higashisonogi.lg.jp/soshiki/gikai/795.html
 * 自治体コード: 423211
 *
 * 東彼杵町は PDF ファイルで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから全 PDF リンクを収集し、
 * detail フェーズで PDF をダウンロードしてテキスト抽出・発言パースを行う。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type HigashisonogiDetailParams } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "423211",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(baseUrl, year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
        headingYear: doc.headingYear,
        heldOn: doc.heldOn,
      } satisfies HigashisonogiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as HigashisonogiDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
