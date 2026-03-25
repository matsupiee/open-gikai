/**
 * 田子町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.takko.lg.jp/index.cfm/13,0,45,190,html
 * 自治体コード: 024431
 *
 * 田子町は ColdFusion CMS 上の年度別ページに議案審議結果 PDF リンクを掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "024431",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        year: m.year,
        meetingSection: m.meetingSection,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      year: number;
      meetingSection: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
