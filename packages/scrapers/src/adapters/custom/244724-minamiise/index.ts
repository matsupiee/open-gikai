/**
 * 南伊勢町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.minamiise.lg.jp/admin/shoshiki/gikaijimu/index.html
 * 自治体コード: 244724
 *
 * 本会議の会議録（議事録本文）はオンライン未公開。
 * 審議結果（議決結果）および一般質問事項 PDF を対象とする。
 *
 * list フェーズで各インデックスページから年度別ページ URL を取得し、
 * PDF リンクを収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出して
 * MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList, toListRecord } from "./list";
import { buildMeetingData, type MinamiiseDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "244724",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(baseUrl, year);
    return records.map(toListRecord);
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MinamiiseDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
