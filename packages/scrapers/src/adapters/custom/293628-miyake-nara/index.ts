/**
 * 三宅町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.miyake.lg.jp/site/gikai/list15.html
 * 自治体コード: 293628
 *
 * 三宅町は自治体公式サイト上で年度別に PDF を公開している。
 * 既存の汎用アダプターでは対応できないため、カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData } from "./detail";
import type { MiyakeDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "293628",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchDocumentList(year);

    return sessions.map((session) => ({
      detailParams: {
        title: session.title,
        year: session.year,
        pdfUrl: session.pdfUrl,
        meetingType: session.meetingType,
      } satisfies MiyakeDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as MiyakeDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
