/**
 * 越知町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ochi.kochi.jp/
 * 自治体コード: 394033
 *
 * 越知町は公式サイトに PDF 形式で会議録を公開しており、
 * 一覧ページ（https://www.town.ochi.kochi.jp/gikai/gijiroku）から
 * 全 PDF リンクを取得してスクレイピングする。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "394033",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        linkText: m.linkText,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      linkText: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
