/**
 * 甘楽町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kanra.lg.jp/gikai/kaigiroku/index.html
 * 自治体コード: 103845
 *
 * 甘楽町は自治体 CMS による PDF 年度別公開形式のため、
 * 既存の汎用アダプターでは対応できない。カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData } from "./detail";
import type { KanraDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "103845",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((session) => ({
      detailParams: {
        title: session.title,
        heldOn: session.heldOn,
        pdfUrl: session.pdfUrl,
        meetingType: session.meetingType,
        detailPageUrl: session.detailPageUrl,
        sessionIndex: session.sessionIndex,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as KanraDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
