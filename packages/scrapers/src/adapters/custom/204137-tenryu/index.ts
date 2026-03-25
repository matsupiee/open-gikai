/**
 * 天龍村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.vill-tenryu.jp/category/notice/administrative/government_info/parliament/
 * 自治体コード: 204137
 *
 * 天龍村は会議録検索システムを導入しておらず、会議録テキストは HTML として公開されていない。
 * 議会活動記録 PDF を情報源として会議情報を取得する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "204137",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        sourceUrl: m.sourceUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      sourceUrl: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
