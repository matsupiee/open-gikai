/**
 * 富良野市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.furano.hokkaido.jp/shigikai/zokusei/gijiroku/
 * 自治体コード: 012297
 *
 * 富良野市は自治体 CMS で PDF ベースの議事録を公開しており、
 * 一覧ページ → 詳細ページ → PDF の3段階構造。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "012297",

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

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      sessionTitle: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
