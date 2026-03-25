/**
 * 大館市議会 — ScraperAdapter 実装
 *
 * サイト: https://www.city.odate.lg.jp/city/handbook/handbook13/page56/kaigiroku
 * 自治体コード: 052043
 *
 * 大館市は公式サイト内で PDF 形式の会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでトップページから年度別ページを辿り、
 * PDF ごとに1レコードを返す。
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type OdateDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "052043",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        sessionGroupTitle: s.sessionGroupTitle,
        dayLabel: s.dayLabel,
      } satisfies OdateDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as OdateDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
