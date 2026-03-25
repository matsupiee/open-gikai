/**
 * 那珂川町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tochigi-nakagawa.lg.jp/05gikai/kaigiroku/
 * 自治体コード: 094111
 *
 * 那珂川町は町独自 CMS により PDF 形式で会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 * 会議録は平成21年（2009年）から令和7年（2025年）まで掲載。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "094111",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
        pdfKey: m.pdfKey,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      meetingType: string;
      pdfKey: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
