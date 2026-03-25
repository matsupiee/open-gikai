/**
 * 度会町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.watarai.lg.jp/category_list.php?frmCd=8-0-0-0-0
 * 自治体コード: 244708
 *
 * 町公式サイト内に年度ごとの PDF ファイルとして掲載されている会議録を対象とする。
 *
 * list フェーズでカテゴリトップから frmId を取得し、年度別ページから PDF リンクを収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList, toListRecord } from "./list";
import { buildMeetingData, type WataraiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "244708",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(baseUrl, year);
    return records.map(toListRecord);
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as WataraiDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
