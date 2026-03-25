/**
 * 小値賀町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.ojika.lg.jp/soshiki/gikaijimukyoku/1/1/3/2/238.html
 * 自治体コード: 423831
 *
 * 小値賀町は町公式サイトで PDF 形式の会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで会議録一覧ページから PDF リンクを収集し、
 * detail フェーズで PDF をダウンロードしてテキスト抽出・発言パースを行う。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type OjikaDetailParams } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "423831",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
        year: doc.year,
        heldOn: doc.heldOn,
      } satisfies OjikaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as OjikaDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
