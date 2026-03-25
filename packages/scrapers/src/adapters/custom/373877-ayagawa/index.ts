/**
 * 綾川町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://ayagawa-gikai.jp/
 * 自治体コード: 373877
 *
 * 綾川町は議会専用サイト（ayagawa-gikai.jp）で PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseIndexPage, parseMeetingPage, parseSubPage } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "373877",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingName: m.meetingName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      meetingName: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
