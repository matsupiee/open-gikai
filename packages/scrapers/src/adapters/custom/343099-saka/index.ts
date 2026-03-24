/**
 * 坂町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.saka.lg.jp/2017/05/30/29/
 * 自治体コード: 343099
 *
 * 坂町は公式サイト（WordPress）で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type SakaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "343099",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
      } satisfies SakaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as SakaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
