/**
 * 高森町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kumamoto-takamori.lg.jp/site/gikai/list32-138.html
 * 自治体コード: 434281
 *
 * 高森町は町公式サイト内で PDF ベースの議事録を年度別ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "434281",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        attachmentId: m.attachmentId,
        title: m.title,
        pdfUrl: m.pdfUrl,
        yearPageUrl: m.yearPageUrl,
        year: m.year,
        month: m.month,
        heldOn: m.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      attachmentId: string;
      title: string;
      pdfUrl: string;
      yearPageUrl: string;
      year: number;
      month: number | null;
      heldOn: string | null;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
