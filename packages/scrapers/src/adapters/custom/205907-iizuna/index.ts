/**
 * 飯綱町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.iizuna.nagano.jp/gikai/kaigiroku/
 * 自治体コード: 205907
 *
 * 飯綱町は独自 CMS で PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "205907",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        detailUrl: m.detailUrl,
        title: m.title,
        year: m.year,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      detailUrl: string;
      title: string;
      year: number | null;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
