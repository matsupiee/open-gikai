/**
 * 室戸市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.muroto.kochi.jp/navi/a02b08.php
 * 自治体コード: 392022
 *
 * 室戸市は市公式サイトに PDF 形式で年別に会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "392022",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        section: m.section,
        pageId: m.pageId,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      section: string;
      pageId: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
