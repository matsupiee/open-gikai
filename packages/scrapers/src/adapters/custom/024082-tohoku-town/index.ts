/**
 * 東北町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku.html
 * 自治体コード: 024082
 *
 * 東北町は町公式サイト内の静的 HTML ページに PDF を直接掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";
import type { TohokuRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "024082",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        year: m.year,
        session: m.session,
        speakerName: m.speakerName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as TohokuRecord;
    return fetchMeetingData(params, municipalityCode);
  },
};
