/**
 * 小川村議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.vill.ogawa.nagano.jp/docs/64436.html
 * 自治体コード: 205885
 *
 * 小川村は PDF ファイルで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで単一の会議録ページから全 PDF リンクを収集し、
 * detail フェーズで PDF をダウンロードしてテキスト抽出・発言パースを行う。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type OgawaNaganoDetailParams } from "./detail";
import { BASE_ORIGIN } from "./shared";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "205885",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(baseUrl, year, BASE_ORIGIN);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
        monthSection: doc.monthSection,
        typeSection: doc.typeSection,
      } satisfies OgawaNaganoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as OgawaNaganoDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
