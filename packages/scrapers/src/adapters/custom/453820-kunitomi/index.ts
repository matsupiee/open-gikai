/**
 * 国富町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: http://www.town.kunitomi.miyazaki.jp/main/administration/town_council/page000865.html
 * 自治体コード: 453820
 *
 * 国富町は PDF ベースの議事録を単一ページに全年度分掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "453820",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingKind: m.meetingKind,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      meetingKind: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
