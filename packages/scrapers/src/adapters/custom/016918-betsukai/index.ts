/**
 * 別海町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://betsukai.jp/gikai/kaigikekka/kaigiroku/
 * 自治体コード: 016918
 *
 * 別海町は自治体サイトで PDF ベースの議事録を年度別ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseYearPage, parseHeadingDate, extractDateFromLinkText, extractDateFromHeading } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "016918",

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
