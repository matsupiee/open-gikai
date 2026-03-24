/**
 * 西米良村議会 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.nishimera.lg.jp/village/category/c-00-admininfo/c-03/c-03-02
 * 自治体コード: 454036
 *
 * WordPress サイトで年度別ページに PDF を公開する形式。
 * カテゴリページ → 年度別記事ページ → PDF の2段階クロール。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "454036",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        linkText: m.linkText,
        articleUrl: m.articleUrl,
        year: m.year,
        meetingType: m.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      linkText: string;
      articleUrl: string;
      year: number;
      meetingType: "plenary" | "extraordinary" | "committee";
    };
    return fetchMeetingData(
      {
        pdfUrl: params.pdfUrl,
        linkText: params.linkText,
        articleUrl: params.articleUrl,
        year: params.year,
        meetingType: params.meetingType,
      },
      municipalityId,
    );
  },
};
