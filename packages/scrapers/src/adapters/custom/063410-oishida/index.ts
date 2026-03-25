/**
 * 大石田町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.oishida.yamagata.jp/chousei/chousei/kaigiroku/index.html
 * 自治体コード: 063410
 *
 * 大石田町は自治体公式サイトで PDF ベースの議事録を年度別ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "063410",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingSection: m.meetingSection,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      meetingSection: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
