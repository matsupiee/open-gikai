/**
 * 山ノ内町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.yamanouchi.nagano.jp/soshiki/gikai_jimukyoku/gyomu/gikai/520.html
 * 自治体コード: 205613
 *
 * 山ノ内町は PDF ファイルで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから全 PDF リンクを収集し、
 * detail フェーズで PDF をダウンロードしてテキスト抽出・発言パースを行う。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type YamanouchiDetailParams } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "205613",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const entries = await fetchDocumentList(baseUrl, year);

    return entries.map((entry) => ({
      detailParams: {
        sessionName: entry.sessionName,
        date: entry.date,
        type: entry.type,
        speakers: entry.speakers,
        pdfUrl: entry.pdfUrl,
        meetingType: entry.meetingType,
        year: entry.year,
      } satisfies YamanouchiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as YamanouchiDetailParams;
    return await buildMeetingData(params, municipalityId);
  },
};
