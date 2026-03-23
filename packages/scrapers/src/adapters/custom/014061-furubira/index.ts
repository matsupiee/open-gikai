/**
 * 古平町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.furubira.lg.jp/town/detail.php?id=59
 * 自治体コード: 014061
 *
 * 古平町は PDF ファイルで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから全 PDF リンクを収集し、
 * detail フェーズで PDF をダウンロードしてテキスト抽出・発言パースを行う。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type FurubiraDetailParams } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "014061",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(baseUrl, year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
        headingYear: doc.headingYear,
      } satisfies FurubiraDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as FurubiraDetailParams;
    return await buildMeetingData(params, municipalityId);
  },
};
