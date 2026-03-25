/**
 * 津幡町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tsubata.lg.jp/page/1738.html
 * 自治体コード: 173614
 *
 * 津幡町は独自 CMS で全会議録 PDF を 1 ページに直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "173614",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        heldUntil: m.heldUntil,
        year: m.year,
        isProvisional: m.isProvisional,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      heldUntil: string | null;
      year: number;
      isProvisional: boolean;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
