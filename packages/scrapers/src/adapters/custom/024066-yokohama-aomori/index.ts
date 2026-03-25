/**
 * 横浜町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.yokohama.lg.jp/index.cfm/10,0,47,html
 * 自治体コード: 024066
 *
 * 横浜町は ColdFusion CMS で会議録を PDF 公開している。
 * 単一の会議録カテゴリページに h6 タグで区切られた定例会・臨時会ブロックが並び、
 * 各ブロックに PDF リンクが掲載される。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";
import type { YokohamaAomoriDocument } from "./list";

export const adapter: ScraperAdapter = {
  name: "024066",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        sessionTitle: doc.sessionTitle,
        linkText: doc.linkText,
        pdfUrl: doc.pdfUrl,
        pageUrl: doc.pageUrl,
        yearHeading: doc.yearHeading,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const doc = detailParams as unknown as YokohamaAomoriDocument;
    return fetchMeetingData(doc, municipalityCode);
  },
};
