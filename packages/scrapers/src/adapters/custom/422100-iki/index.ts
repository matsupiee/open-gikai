/**
 * 壱岐市議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.city.iki.nagasaki.jp/soshiki/gikai_jimukyoku/shigikai/kaigiroku/index.html
 * 自治体コード: 422100
 *
 * 壱岐市は SMART CMS による PDF 公開形式で会議録を提供しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度一覧ページ → 年度別ページ → PDF リンクを収集し、
 * detail フェーズで PDF をダウンロードしてテキスト抽出・発言パースを行う。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type IkiDetailParams } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "422100",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
        headingYear: doc.headingYear,
        heldOn: doc.heldOn,
      } satisfies IkiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as IkiDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
