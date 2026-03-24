/**
 * 佐々町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.sazacho-nagasaki.jp/gikai/list00807.html
 * 自治体コード: 423912
 *
 * 佐々町は町公式サイトで PDF 形式の会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで 3 階層構造（トップ → 年度別一覧 → 会議詳細）を辿って PDF リンクを収集し、
 * detail フェーズで PDF をダウンロードしてテキスト抽出・発言パースを行う。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type SazaDetailParams } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "423912",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        meetingType: doc.meetingType,
        year: doc.year,
        heldOn: doc.heldOn,
      } satisfies SazaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as SazaDetailParams;
    return await buildMeetingData(params, municipalityId);
  },
};
