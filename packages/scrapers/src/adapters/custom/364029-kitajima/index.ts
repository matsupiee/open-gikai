/**
 * 北島町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kitajima.lg.jp/docs/402721.html
 * 自治体コード: 364029
 *
 * 北島町は町公式サイトで会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから定例会 PDF リンクを収集し、
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type KitajimaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "364029",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        pdfPath: s.pdfPath,
      } satisfies KitajimaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as KitajimaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
