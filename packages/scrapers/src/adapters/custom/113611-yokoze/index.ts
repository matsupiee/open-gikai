/**
 * 横瀬町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.yokoze.saitama.jp/yokoze/about-yokoze/5696
 * 自治体コード: 113611
 *
 * 横瀬町は WordPress ベースの静的 HTML で PDF リンクを公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "113611",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        year: m.year,
        month: m.month,
        sessionType: m.sessionType,
        heldOn: m.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      year: number;
      month: number;
      sessionType: string;
      heldOn: string | null;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
