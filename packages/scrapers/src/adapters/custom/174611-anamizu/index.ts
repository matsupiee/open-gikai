/**
 * 穴水町議会 会議録 — ScraperAdapter 実装
 *
 * サイト:
 * - 現行: https://www.town.anamizu.lg.jp/site/gikai/100411.html
 * - バックナンバー: https://www.town.anamizu.lg.jp/site/gikai/100416.html
 * 自治体コード: 174611
 *
 * 穴水町は町公式サイトで PDF 会議録を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "174611",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        heldOn: meeting.heldOn,
        year: meeting.year,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      year: number;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
