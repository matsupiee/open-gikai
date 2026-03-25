/**
 * 階上町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.hashikami.lg.jp/index.cfm/9,0,46,438,html
 * 自治体コード: 024465
 *
 * 階上町は ColdFusion CMS 上の単一ページに全会議録 PDF リンクを掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "024465",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        year: m.year,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      year: number;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
