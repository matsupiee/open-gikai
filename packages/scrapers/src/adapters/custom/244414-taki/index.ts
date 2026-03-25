/**
 * 多気町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.taki.mie.jp/life/soshiki/gikai_jimukyoku/
 * 自治体コード: 244414
 *
 * 一般質問会議録 PDF を対象とする。
 * 議事録本文が公開されているのは令和5年以降のみ。
 *
 * list フェーズで kaigiroku/index.html から年度別ページ URL を取得し、
 * PDF リンクを収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出して
 * MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList, toListRecord } from "./list";
import { buildMeetingData, type TakiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "244414",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(baseUrl, year);
    return records.map(toListRecord);
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as TakiDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
