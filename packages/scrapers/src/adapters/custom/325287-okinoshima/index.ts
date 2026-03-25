/**
 * 隠岐の島町（島根県）議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.okinoshima.shimane.jp/
 * 自治体コード: 325287
 *
 * 隠岐の島町は自治体公式サイト（SMART CMS）で PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "325287",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        label: m.label,
        heldOn: m.heldOn,
        category: m.category,
        pdfKey: m.pdfKey,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      label: string;
      heldOn: string | null;
      category: string;
      pdfKey: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
