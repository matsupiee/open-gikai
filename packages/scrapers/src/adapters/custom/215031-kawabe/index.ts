/**
 * 川辺町議会（岐阜県） 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.kawabe-gifu.jp/?page_id=48191
 * 自治体コード: 215031
 *
 * WordPress サイトで PDF を直接公開。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "215031",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        linkText: m.linkText,
        uploadYear: m.uploadYear,
        uploadMonth: m.uploadMonth,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      linkText: string;
      uploadYear: number;
      uploadMonth: number;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
