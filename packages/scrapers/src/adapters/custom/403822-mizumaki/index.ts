/**
 * 水巻町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.mizumaki.lg.jp/li/gyosei/030/010/
 * 自治体コード: 403822
 *
 * 水巻町は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでトップページから年度コード → 年度インデックス → 各会議詳細ページを辿り、
 * gijiroku.pdf の URL を収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type MizumakiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "403822",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        pageId: s.pageId,
        nendoYear: s.nendoYear,
      } satisfies MizumakiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MizumakiDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
