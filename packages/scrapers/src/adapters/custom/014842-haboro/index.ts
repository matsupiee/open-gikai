/**
 * 羽幌町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.haboro.lg.jp/gikai-iinkai/gikai/gijiroku/
 * 自治体コード: 014842
 *
 * PDF（H25以降）と HTML（H18〜H24）の混在サイト。
 * 年度別ページの URL パターンが統一されていないため、マッピングテーブルで管理する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "014842",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        url: m.url,
        title: m.title,
        heldOn: m.heldOn,
        section: m.section,
        format: m.format,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      url: string;
      title: string;
      heldOn: string;
      section: string;
      format: "pdf" | "html";
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
