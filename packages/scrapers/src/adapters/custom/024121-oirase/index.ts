/**
 * おいらせ町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.oirase.aomori.jp/site/gikai/
 * 自治体コード: 024121
 *
 * おいらせ町は年度別ページに定例会・臨時会の PDF を公開している。
 * 一覧ページから年度別ページ URL を収集し、各ページから PDF リンクを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";
import type { OiraseDocument } from "./list";

export const adapter: ScraperAdapter = {
  name: "024121",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        pageUrl: doc.pageUrl,
        rawDateText: doc.rawDateText,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const doc = detailParams as unknown as OiraseDocument;
    return fetchMeetingData(doc, municipalityCode);
  },
};
