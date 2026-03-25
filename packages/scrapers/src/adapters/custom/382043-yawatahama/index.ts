/**
 * 八幡浜市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.yawatahama.ehime.jp/gikai/
 * 自治体コード: 382043
 *
 * 八幡浜市は独自の CMS で会議録を HTML として公開しており、
 * 既存の汎用アダプターでは対応できないため、カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseListPage } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "382043",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        detailUrl: doc.detailUrl,
        path: doc.path,
        sessionTitle: doc.sessionTitle,
        heldOn: doc.heldOn,
        year: doc.year,
        meetingKind: doc.meetingKind,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      detailUrl: string;
      path: string;
      sessionTitle: string;
      heldOn: string | null;
      year: number;
      meetingKind: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
