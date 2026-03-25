/**
 * 河合町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kawai.nara.jp/10/1_1/1/2/index.html
 * 自治体コード: 294276
 *
 * 河合町は自治体公式サイト上で年度別に PDF を公開している。
 * 既存の汎用アダプターでは対応できないため、カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData } from "./detail";
import type { KawaiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "294276",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((session) => ({
      detailParams: {
        title: session.title,
        heldOn: session.heldOn,
        pdfUrl: session.pdfUrl,
        meetingType: session.meetingType,
      } satisfies KawaiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KawaiDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
