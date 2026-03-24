/**
 * 宿毛市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.sukumo.kochi.jp/01/04/02/02/
 * 自治体コード: 392081
 *
 * 宿毛市は市公式サイトに PDF 形式で年別に会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "392081",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        section: m.section,
        year: m.year,
        month: m.month,
        meetingSession: m.meetingSession,
        meetingKind: m.meetingKind,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      section: string;
      year: number;
      month: number | null;
      meetingSession: number;
      meetingKind: "定例会" | "臨時会";
    };
    return fetchMeetingData(params, municipalityId);
  },
};
