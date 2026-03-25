/**
 * 高原町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.takaharu.lg.jp/site/gikai/list18.html
 * バックナンバー: https://www.town.takaharu.lg.jp/site/gikai/296447.html
 * 自治体コード: 453617
 *
 * 高原町は PDF ベースの議事録をバックナンバーページに全年度分掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "453617",

  async fetchList({ baseUrl: _baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingKind: m.meetingKind,
        year: m.year,
        session: m.session,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      meetingKind: string;
      year: number;
      session: number;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
