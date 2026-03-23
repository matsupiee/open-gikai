/**
 * 上三川町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kaminokawa.lg.jp/0192/genre2-0-001.html
 * 自治体コード: 093017
 *
 * 上三川町は自治体 CMS により PDF 形式で会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "093017",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        description: m.description,
        pdfHash: m.pdfHash,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      description: string;
      pdfHash: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
