/**
 * 斑鳩町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ikaruga.nara.jp/0000000402.html
 * 自治体コード: 293440
 *
 * 斑鳩町は独自 CMS で PDF 公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "293440",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        category: m.category,
        pageLabel: m.pageLabel,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      category: string;
      pageLabel: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
