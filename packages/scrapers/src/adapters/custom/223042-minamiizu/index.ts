/**
 * 南伊豆町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.minamiizu.shizuoka.jp/category/bunya/tyougikai/gijiroku/
 * 自治体コード: 223042
 *
 * 南伊豆町は PDF ベースの議事録を3つの期間別一覧ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "223042",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        section: m.section,
        filename: m.filename,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      section: string;
      filename: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
