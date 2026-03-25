/**
 * 新居浜市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.niihama.lg.jp/site/gikai/
 * 自治体コード: 382051
 *
 * 新居浜市は独自の HTML ページで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないため、カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseListPage } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "382051",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        year: doc.year,
        session: doc.session,
        number: doc.number,
        sessionTitle: doc.sessionTitle,
        heldOn: doc.heldOn,
        path: doc.path,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      year: number;
      session: number;
      number: number;
      sessionTitle: string;
      heldOn: string;
      path: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
