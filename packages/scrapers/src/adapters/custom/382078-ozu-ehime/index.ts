/**
 * 大洲市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.ozu.ehime.jp/kaigiroku/index.html
 * 自治体コード: 382078
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "382078",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        year: doc.year,
        sessionTitle: doc.sessionTitle,
        fileKey: doc.fileKey,
        eraDir: doc.eraDir,
        detailUrl: doc.detailUrl,
        heldYearMonth: doc.heldYearMonth,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      year: number;
      sessionTitle: string;
      fileKey: string;
      eraDir: string;
      detailUrl: string;
      heldYearMonth: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
