/**
 * 利島村議会 — ScraperAdapter 実装
 *
 * サイト: https://www.toshimamura.org/about/assembly.html
 * 自治体コード: 133621
 *
 * 利島村は議会情報ページに年度別の議事録 PDF を直接掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "133621",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        year: m.year,
        sessionType: m.sessionType,
        sessionNumber: m.sessionNumber,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      year: number;
      sessionType: "定例会" | "臨時会";
      sessionNumber: string;
    };
    return fetchMeetingData(
      {
        pdfUrl: params.pdfUrl,
        title: params.title,
        year: params.year,
        sessionType: params.sessionType,
        sessionNumber: params.sessionNumber,
      },
      municipalityId
    );
  },
};
