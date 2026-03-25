/**
 * 日吉津村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.hiezu.jp/list/gikai/y446/
 * 自治体コード: 313840
 *
 * 日吉津村は自治体 CMS で PDF ベースの議事録を
 * 年度別 → 会議別 → 議事区分別の階層構造で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "313840",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        section: m.section,
        meetingName: m.meetingName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      section: string;
      meetingName: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
