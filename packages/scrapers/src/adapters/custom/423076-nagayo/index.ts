/**
 * 長与町議会 -- ScraperAdapter 実装
 *
 * サイト: https://webtown.nagayo.jp/gikai/list00423.html
 * 自治体コード: 423076
 *
 * 長与町は PDF ファイルで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで5つの一覧ページから全 PDF リンクを収集し、
 * detail フェーズで PDF をダウンロードしてテキスト抽出・発言パースを行う。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type NagayoDetailParams } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "423076",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(baseUrl, year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
        headingYear: doc.headingYear,
        heldOn: doc.heldOn,
        meetingCategory: doc.meetingCategory,
      } satisfies NagayoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as NagayoDetailParams;
    return await buildMeetingData(params, municipalityId);
  },
};
