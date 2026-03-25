/**
 * 東村山市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.higashimurayama.tokyo.jp/gikai/gikaijoho/kensaku/
 * 自治体コード: 132136
 *
 * 東村山市は独自 CMS で PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseListPage } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "132136",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        section: m.section,
        category: m.category,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      section: string;
      category: "honkaigi" | "iinkai";
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
