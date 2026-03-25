/**
 * 東洋町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: http://www.town.toyo.kochi.jp/gikai-toyo/kaigiroku.html
 * 自治体コード: 393011
 *
 * 東洋町は独自 CMS による静的 HTML + PDF で会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 * トップページから年度別ページ URL を収集し、各年度ページから PDF リンクを収集する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "393011",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        session: m.session,
        text: m.text,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      session: string;
      text: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
