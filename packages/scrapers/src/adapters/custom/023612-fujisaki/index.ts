/**
 * 藤崎町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.fujisaki.lg.jp/index.cfm/9,17429,html
 * 自治体コード: 023612
 *
 * 藤崎町は ColdFusion CMS で PDF ベースの議事録を年度別ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "023612",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        session: m.session,
        fileKey: m.fileKey,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      session: string;
      fileKey: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
