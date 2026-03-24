/**
 * 輪之内町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://town.wanouchi.gifu.jp/portal/town/parliament/kaigiroku-parliament/
 * 自治体コード: 213829
 *
 * 輪之内町は WordPress ベースの自治体サイトで PDF ベースの議事録を年度別ページに公開。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "213829",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        fileCode: m.fileCode,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      fileCode: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
