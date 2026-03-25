/**
 * 七宗町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.hichiso.jp/top/gyosei/parlament/record/
 * 自治体コード: 215040
 *
 * WordPress サイトで PDF を直接公開。テキストレイヤーあり。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "215040",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        sessionType: m.sessionType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      sessionType: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
