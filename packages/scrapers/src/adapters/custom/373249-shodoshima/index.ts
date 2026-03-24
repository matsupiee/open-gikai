/**
 * 小豆島町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/index.html
 * 自治体コード: 373249
 *
 * 小豆島町は年別リンク形式で PDF ベースの議事録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseIndexPage, parseYearPage, parseHeldOn } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "373249",

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

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      meetingName: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
