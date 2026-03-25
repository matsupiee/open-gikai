/**
 * 吉野町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.yoshino.nara.jp/gikai/kaigiroku/index.html
 * 自治体コード: 294411
 *
 * 吉野町は公式サイト上で年度別に PDF を公開している（SMART CMS）。
 * 既存の汎用アダプターでは対応できないため、カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData } from "./detail";
import type { YoshinoDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "294411",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((session) => ({
      detailParams: {
        title: session.title,
        heldOn: session.heldOn,
        pdfUrl: session.pdfUrl,
        meetingType: session.meetingType,
      } satisfies YoshinoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as YoshinoDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
