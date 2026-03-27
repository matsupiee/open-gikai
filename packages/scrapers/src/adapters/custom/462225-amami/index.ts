/**
 * 奄美市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.amami.lg.jp/gikai/shise/shigikai/gaiyo.html
 * 自治体コード: 462225
 *
 * 奄美市は公式サイトで年度別に会議録 PDF を公開しており、
 * 一部年度に分割ページ・分割 PDF があるためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "462225",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((meeting) => ({
      detailParams: {
        title: meeting.title,
        pdfUrls: meeting.pdfUrls,
        pageUrl: meeting.pageUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      title: string;
      pdfUrls: string[];
      pageUrl: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
