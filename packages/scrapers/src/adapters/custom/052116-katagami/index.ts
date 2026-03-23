/**
 * 潟上市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.katagami.lg.jp/gyosei/gyoseijoho/shigikai/kaigiroku/index.html
 * 自治体コード: 052116
 *
 * 潟上市は市役所独自ページで会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "052116",

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
