/**
 * 笠松町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kasamatsu.gifu.jp/category/bunya/chouno_jouhou/gikai/gikaikaigiroku/
 * 自治体コード: 213039
 *
 * 笠松町は独自 CMS による PDF 公開形式で会議録を提供しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "213039",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
