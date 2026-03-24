/**
 * 黒石市議会 — ScraperAdapter 実装
 *
 * サイト: http://www.city.kuroishi.aomori.jp/shisei/gikai/gikai_kaigiroku.html
 * 自治体コード: 022047
 *
 * 黒石市は全ての会議録を PDF 形式で公開している。
 * 全年度が単一ページに掲載されており、ファイル名から年・回数・号数を判定する。
 * 平成期（H）と令和期（R）のファイル名パターンに対応。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { fetchMeetingData, type KuroishiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "022047",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        meetingType: s.meetingType,
        pdfUrl: s.pdfUrl,
      } satisfies KuroishiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as KuroishiDetailParams;
    return fetchMeetingData(params, municipalityId);
  },
};
