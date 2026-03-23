/**
 * 板倉町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.itakura.gunma.jp/d000070/d000030/index.html
 * 自治体コード: 105210
 *
 * 板倉町は市公式サイト内で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度別ページから詳細ページを辿り、
 * 各会議の PDF リンクを収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * 〇マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type ItakuraDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "105210",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        detailUrl: s.detailUrl,
      } satisfies ItakuraDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as ItakuraDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
