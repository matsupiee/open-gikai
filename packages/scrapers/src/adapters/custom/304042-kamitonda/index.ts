/**
 * 上富田町議会 — ScraperAdapter 実装
 *
 * サイト: http://www.town.kamitonda.lg.jp/soshiki/gikai/kaigiroku/index.html
 * 自治体コード: 304042
 *
 * 上富田町は独自 CMS による HTML 公開・PDF ダウンロード形式のため、
 * カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData } from "./detail";
import type { KamitondaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "304042",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((session) => ({
      detailParams: {
        title: session.title,
        heldOn: session.heldOn,
        pdfUrl: session.pdfUrl,
        meetingType: session.meetingType,
        fileName: session.fileName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as KamitondaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
