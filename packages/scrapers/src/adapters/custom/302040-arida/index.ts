/**
 * 有田市議会 — ScraperAdapter 実装
 *
 * サイト: https://www.city.arida.lg.jp/shigikai/honkaigiroku/index.html
 * 自治体コード: 302040
 *
 * 有田市は年度別 PDF 公開で会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでトップ → 年度 → 会議詳細ページを辿り、
 * セッション日ごとの PDF URL を収集する。
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type AridaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "302040",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        meetingId: s.meetingId,
      } satisfies AridaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as AridaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
