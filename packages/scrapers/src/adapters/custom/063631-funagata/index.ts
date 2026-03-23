/**
 * 舟形町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.funagata.yamagata.jp/li/gikai/010/
 * 自治体コード: 063631
 *
 * 舟形町は自治体公式サイトで PDF ベースの議事録を年度別ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export { parseTopPage, parseYearPage, parseDateFromH3, extractYearFromLabel } from "./list";
export { parseStatements, normalizeRole, classifyKind, findProceedingsStart } from "./detail";

export const adapter: ScraperAdapter = {
  name: "063631",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        section: m.section,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      section: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
