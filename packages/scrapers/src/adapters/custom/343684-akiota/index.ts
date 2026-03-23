/**
 * 安芸太田町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.akiota.jp/site/gikai/list26-80.html
 * 自治体コード: 343684
 *
 * 安芸太田町は公式サイトで会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type AkiotaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "343684",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
      } satisfies AkiotaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as AkiotaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
