/**
 * 森町議会（静岡県）会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.morimachi.shizuoka.jp/
 * 自治体コード: 224618
 *
 * 森町は PDF ベースの議事録を年度別ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "224618",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        section: m.section,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      section: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
