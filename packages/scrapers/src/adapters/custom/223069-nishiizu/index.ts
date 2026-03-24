/**
 * 西伊豆町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: http://www.town.nishiizu.shizuoka.jp/kakuka/gikai/gijiroku/index.html
 * 自治体コード: 223069
 *
 * 西伊豆町は PDF ベースの議事録を公開しており、
 * 一覧ページ → 中間ページ → PDF の 2 ホップ構造を持つ。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "223069",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
        pageNum: m.pageNum,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      meetingType: string;
      pageNum: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
