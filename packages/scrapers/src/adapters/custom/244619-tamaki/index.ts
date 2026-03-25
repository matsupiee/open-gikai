/**
 * 玉城町議会 -- ScraperAdapter 実装
 *
 * サイト: https://kizuna.town.tamaki.mie.jp/chosei/senkyogikai/gikai/shingi/gijiroku.html
 * 自治体コード: 244619
 *
 * 議事録は年度ごとの HTML 目次ページ経由で PDF ファイルとして公開されている。
 *
 * list フェーズで索引ページから年度別目次 URL を取得し、
 * PDF リンクを収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出して
 * MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList, toListRecord } from "./list";
import { buildMeetingData, type TamakiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "244619",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(baseUrl, year);
    return records.map(toListRecord);
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as TamakiDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
