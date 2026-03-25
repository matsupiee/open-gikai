/**
 * 日野町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.hino.tottori.jp/1660.htm
 * 自治体コード: 314021
 *
 * 日野町は自治体 CMS で PDF ベースの議事録を一覧ページ→詳細ページ→PDF の
 * 2段階構造で公開しており、既存の汎用アダプターでは対応できないため
 * カスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "314021",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        sessionTitle: m.sessionTitle,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      sessionTitle: string;
    };
    return fetchMeetingData(
      {
        pdfUrl: params.pdfUrl,
        title: params.title,
        heldOn: params.heldOn,
        sessionTitle: params.sessionTitle,
      },
      municipalityCode,
    );
  },
};
