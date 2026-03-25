/**
 * 玖珠町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kusu.oita.jp/choseijoho/kusuchogikai/1/index.html
 * 自治体コード: 444626
 *
 * 玖珠町は SMART CMS 上で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度別ページから PDF URL を収集し、
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type KusuDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "444626",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        detailPageUrl: s.detailPageUrl,
      } satisfies KusuDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KusuDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
