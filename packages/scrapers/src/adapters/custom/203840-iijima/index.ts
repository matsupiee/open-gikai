/**
 * 飯島町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.iijima.lg.jp/soshikiichiran/gikaijimukyoku/gikai/gikai_kuroku/91.html
 * 自治体コード: 203840
 *
 * 飯島町は自治体公式サイト上の静的 HTML ページに PDF リンクを一覧掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "203840",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        section: m.section,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      section: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
