/**
 * 岐阜県山県市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.yamagata.gifu.jp/site/gikai/list59.html
 * 自治体コード: 212156
 *
 * 山県市は公式ウェブサイトによる年度別 PDF 公開形式で会議録を提供しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "212156",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        fiscalYear: m.fiscalYear,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      fiscalYear: number;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
