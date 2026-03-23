/**
 * 筑北村議会（実態: 筑西市議会） — ScraperAdapter 実装
 *
 * DiscussVision Smart API (tenant_id=516, tenant=chikusei) を使用。
 * 自治体コード: 204528
 *
 * councilrd/all API から会議・日程・発言者情報を取得する。
 * minute/text API はデータ未登録のため、playlist の content（議題一覧）を
 * statements として使用する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import type { PlaylistItem } from "./list";
import { buildMeetingData } from "./detail";

export { parseCouncilResponse } from "./list";
export { parseSpeaker, classifyKind, parseStatements } from "./detail";

export const adapter: ScraperAdapter = {
  name: "204528",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        councilId: doc.councilId,
        councilLabel: doc.councilLabel,
        councilYear: doc.councilYear,
        scheduleId: doc.scheduleId,
        scheduleLabel: doc.scheduleLabel,
        playlist: doc.playlist,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      councilId: string;
      councilLabel: string;
      councilYear: string;
      scheduleId: string;
      scheduleLabel: string;
      playlist: PlaylistItem[];
    };
    return buildMeetingData(params, municipalityId);
  },
};
