/**
 * 小坂町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kosaka.akita.jp/kurashi_gyosei/kosakamachigikai/kaigiroku/index.html
 * 自治体コード: 053031
 *
 * 小坂町は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでトップページ → 年度別一覧 → 各会議詳細を辿り、
 * PDF ごとに1レコードを返す。
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type KosakaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "053031",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        detailUrl: s.detailUrl,
        pdfLabel: s.pdfLabel,
      } satisfies KosakaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as KosakaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
