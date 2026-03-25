/**
 * 那智勝浦町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.nachikatsuura.wakayama.jp/info/1531
 * 自治体コード: 304212
 *
 * 那智勝浦町は独自 CMS による HTML 公開・PDF ダウンロード形式のため、
 * カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData } from "./detail";
import type { NachikatsuuraDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "304212",

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
    const params = detailParams as unknown as NachikatsuuraDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
