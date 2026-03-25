/**
 * 内灘町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.uchinada.lg.jp/site/gikai/list99-130.html
 * 自治体コード: 173657
 *
 * 内灘町は独自 CMS で会議録 PDF を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "173657",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        pageTitle: m.pageTitle,
        contentLabel: m.contentLabel,
        heldOn: m.heldOn,
        year: m.year,
        meetingPageUrl: m.meetingPageUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      pageTitle: string;
      contentLabel: string;
      heldOn: string | null;
      year: number;
      meetingPageUrl: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
