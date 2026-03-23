/**
 * 飛騨市議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.city.hida.gifu.jp/site/gikai/
 * 自治体コード: 212172
 *
 * 飛騨市は PDF ファイルで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度ページ＋一般質問個人別ページから全 PDF リンクを収集し、
 * detail フェーズで PDF をダウンロードしてテキスト抽出・発言パースを行う。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type HidaDetailParams } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "212172",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
        heldOn: doc.heldOn,
        speakerName: doc.speakerName,
        sessionTitle: doc.sessionTitle,
      } satisfies HidaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as HidaDetailParams;
    return await buildMeetingData(params, municipalityId);
  },
};
