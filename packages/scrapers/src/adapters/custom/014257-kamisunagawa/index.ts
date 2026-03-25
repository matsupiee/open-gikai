/**
 * 上砂川町議会 -- ScraperAdapter 実装
 *
 * サイト: https://town.kamisunagawa.hokkaido.jp/gikai_jimukyoku/kekka/index.html
 * 自治体コード: 014257
 *
 * 上砂川町は公式サイト内で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度別一覧ページから各回の結果ページを辿り、PDF URL を収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type KamisunagawaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "014257",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        nendoCode: s.nendoCode,
        sessionType: s.sessionType,
        pageId: s.pageId,
      } satisfies KamisunagawaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KamisunagawaDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
