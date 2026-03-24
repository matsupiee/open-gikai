/**
 * 美郷町（島根県）議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://gov.town.shimane-misato.lg.jp/gikai/1910/
 * 自治体コード: 324485
 *
 * 美郷町（島根県）は自治体公式サイトで PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "324485",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        category: m.category,
        pdfKey: m.pdfKey,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      category: string;
      pdfKey: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
