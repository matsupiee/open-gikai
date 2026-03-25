/**
 * 中泊町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/index.html
 * 自治体コード: 023876
 *
 * 中泊町は年度別ページに定例会・臨時会の PDF を公開している。
 * 一覧ページから年度別ページ URL を収集し、各ページから PDF リンクを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";
import type { NakadomariDocument } from "./list";

export const adapter: ScraperAdapter = {
  name: "023876",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        title: doc.title,
        pdfUrl: doc.pdfUrl,
        pageUrl: doc.pageUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const doc = detailParams as unknown as NakadomariDocument;
    return fetchMeetingData(doc, municipalityCode);
  },
};
