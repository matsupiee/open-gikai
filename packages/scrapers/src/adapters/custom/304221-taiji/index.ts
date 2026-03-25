/**
 * 太地町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.taiji.wakayama.jp/gikai/
 * 自治体コード: 304221
 *
 * 太地町は静的 HTML 公開・PDF ダウンロード形式のため、
 * カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData } from "./detail";
import type { TaijiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "304221",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchDocumentList(year);

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

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as TaijiDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
