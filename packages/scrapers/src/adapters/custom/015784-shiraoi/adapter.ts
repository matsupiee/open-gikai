/**
 * 白老町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.shiraoi.hokkaido.jp/docs/page2014063000011.html
 * 自治体コード: 015784
 *
 * 白老町は自治体 CMS で PDF 形式の会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "015784",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      meetingType: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
