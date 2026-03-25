/**
 * 道志村議会 -- ScraperAdapter 実装
 *
 * サイト: http://www.vill.doshi.lg.jp/
 * 自治体コード: 194221
 *
 * 道志村は村公式サイト内で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから全 PDF リンクを収集し、対象年度に絞り込む。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import {
  buildMeetingData,
  type DoshiDetailParams,
} from "./detail";

export const adapter: ScraperAdapter = {
  name: "194221",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
      } satisfies DoshiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as DoshiDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
