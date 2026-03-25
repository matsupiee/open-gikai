/**
 * 阿波市議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.city.awa.lg.jp/gikai/category/bunya/kaigiroku
 * 自治体コード: 362069
 *
 * 阿波市は市公式サイト内で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページからページネーションを辿り、
 * 各会期ページの PDF リンクを収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type AwaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "362069",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        pageId: s.pageId,
      } satisfies AwaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as AwaDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
