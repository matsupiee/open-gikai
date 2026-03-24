/**
 * 羽後町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ugo.lg.jp/administration/detail.html?id=1247&category_id=51
 * 自治体コード: 054631
 *
 * 羽後町は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで最新年ページ・過去分目次ページ → 年度別ページ → PDF リンクを辿り、
 * PDF ごとに1レコードを返す。
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type UgoDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "054631",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        yearPageUrl: s.yearPageUrl,
        pdfLabel: s.pdfLabel,
        meetingName: s.meetingName,
      } satisfies UgoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as UgoDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
