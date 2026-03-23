/**
 * 足寄町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ashoro.hokkaido.jp/gikai/kaigiroku/
 * 自治体コード: 016471
 *
 * 足寄町は自治体公式サイトで PDF 形式の会議録を年度別に公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseListPage, buildDate } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "016471",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        category: m.category,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      category: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
