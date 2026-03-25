/**
 * 遊佐町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.yuza.yamagata.jp/ou/gikai/gikai/pd0223162117.html
 * 自治体コード: 064611
 *
 * 遊佐町は自治体公式サイトで PDF ベースの議事録を公開しており、
 * 年度別ページから PDF リンクを収集するカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "064611",

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

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      sessionName: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
