/**
 * 白馬村議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.vill.hakuba.lg.jp/gyosei/gyoseijoho/hakubamuragikai/1871.html
 * 自治体コード: 204854
 *
 * 白馬村は PDF ファイルで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから全 PDF リンクを収集し、
 * detail フェーズで PDF をダウンロードしてテキスト抽出・発言パースを行う。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type HakubaDetailParams } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "204854",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(baseUrl, year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
        headingYear: doc.headingYear,
      } satisfies HakubaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as HakubaDetailParams;
    return await buildMeetingData(params, municipalityId);
  },
};
