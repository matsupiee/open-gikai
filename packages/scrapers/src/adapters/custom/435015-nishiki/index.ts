/**
 * 錦町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kumamoto-nishiki.lg.jp/list00253.html
 * 自治体コード: 435015
 *
 * 錦町は独自 CMS で PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";
import type { NishikiMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "435015",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        kijiId: m.kijiId,
        title: m.title,
        pdfUrl: m.pdfUrl,
        heldOn: m.heldOn,
        externalId: m.externalId,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as NishikiMeeting;
    return fetchMeetingData(params, municipalityId);
  },
};
