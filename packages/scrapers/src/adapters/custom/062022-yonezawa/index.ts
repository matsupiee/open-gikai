/**
 * 米沢市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.yonezawa.yamagata.jp/soshiki/12/1037/5/1/260.html
 * 自治体コード: 062022
 *
 * 米沢市は独自 CMS で PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseIndexPage, parseSessionPage, parseDateFromFilename } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "062022",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        sessionName: m.sessionName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      sessionName: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
