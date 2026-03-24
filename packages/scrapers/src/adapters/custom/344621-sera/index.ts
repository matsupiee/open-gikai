/**
 * 世羅町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.sera.hiroshima.jp/soshiki/16/14729.html
 * 自治体コード: 344621
 *
 * 世羅町は公式サイトで会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type SeraDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "344621",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
      } satisfies SeraDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as SeraDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
