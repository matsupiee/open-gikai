/**
 * 土佐清水市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.tosashimizu.kochi.jp/kurashi/section/gikai/042.html
 * 自治体コード: 392090
 *
 * 土佐清水市は市公式サイトに PDF 形式で会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "392090",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        meetingTitle: m.meetingTitle,
        detailUrl: m.detailUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      meetingTitle: string;
      detailUrl: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
