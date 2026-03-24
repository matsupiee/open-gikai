/**
 * 由布市議会 — ScraperAdapter 実装
 *
 * サイト: https://www.city.yufu.oita.jp/
 * 自治体コード: 442135
 *
 * 由布市は市公式サイト（WordPress ベース）で PDF を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから PDF URL を収集し、
 * detail フェーズでは PDF をダウンロードして発言データを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { fetchMeetingData, type YufuDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "442135",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
      } satisfies YufuDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as YufuDetailParams;
    return fetchMeetingData(params, municipalityId);
  },
};
