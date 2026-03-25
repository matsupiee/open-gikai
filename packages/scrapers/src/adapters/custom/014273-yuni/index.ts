/**
 * 由仁町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.yuni.lg.jp/chosei/gikai/teireikai
 * 自治体コード: 014273
 *
 * 由仁町は WordPress による PDF 公開形式のため、
 * 会議録はすべて PDF として提供される。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMinutesLinks } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "014273",

  async fetchList({ year }): Promise<ListRecord[]> {
    const links = await fetchMinutesLinks(year);

    return links.map((link) => ({
      detailParams: {
        pdfUrl: link.pdfUrl,
        meetingType: link.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const { pdfUrl, meetingType } = detailParams as {
      pdfUrl: string;
      meetingType: string;
    };
    return fetchMeetingData({ pdfUrl, meetingType }, municipalityCode);
  },
};
