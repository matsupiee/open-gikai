/**
 * 上牧町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kanmaki.nara.jp/soshiki/gikaijimu/gyomu/gikai/about_gikai/353.html
 * 自治体コード: 294241
 *
 * 上牧町は自治体公式サイト上で PDF 文書を公開しており、
 * HTML の会議録検索システムが存在しないため、カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData } from "./detail";
import type { KanmakiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "294241",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((session) => ({
      detailParams: {
        title: session.title,
        heldOn: session.heldOn,
        pdfUrl: session.pdfUrl,
        meetingType: session.meetingType,
        linkText: session.linkText,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KanmakiDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
