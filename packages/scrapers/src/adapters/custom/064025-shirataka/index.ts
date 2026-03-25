/**
 * 白鷹町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.shirataka.lg.jp/1138.htm
 * 自治体コード: 064025
 *
 * 白鷹町は自治体公式サイトで PDF ベースの議事録を1ページに全年度分掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "064025",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        sessionName: m.sessionName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      sessionName: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
