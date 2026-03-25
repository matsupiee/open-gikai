/**
 * 新郷村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.shingo.aomori.jp/page-25971/
 * 自治体コード: 024503
 *
 * 新郷村は WordPress ベースの村公式サイトで会議録 PDF を公開しており、
 * 年度ごとのページ URL に規則性がないため、カスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "024503",

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

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      year: number;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
