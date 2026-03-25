/**
 * 新上五島町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://official.shinkamigoto.net/goto_chosei.php?wcid=l00002x4
 * 自治体コード: 424111
 *
 * 新上五島町は自治体独自 CMS で PDF 形式の会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから年度別 eid を取得し各年度ページから PDF リンクを収集、
 * detail フェーズで PDF をダウンロードしてテキスト抽出・発言パースを行う。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type ShinkamigotoDetailParams } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "424111",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
        year: doc.year,
        heldOn: doc.heldOn,
        eraYearText: doc.eraYearText,
      } satisfies ShinkamigotoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as ShinkamigotoDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
