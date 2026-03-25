/**
 * 今別町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.imabetsu.lg.jp/gyousei/gikai/
 * 自治体コード: 023035
 *
 * 今別町は会議録をオンライン公開しておらず、「議会だより」（PDF）のみ提供されている。
 * dayori.html から PDF リンクを収集し、PDF テキストを段落単位で格納する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";
import type { ImabetsuDocument } from "./list";

export const adapter: ScraperAdapter = {
  name: "023035",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        issue: doc.issue,
        heldOn: doc.heldOn,
        pdfUrl: doc.pdfUrl,
        year: doc.year,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const doc = detailParams as unknown as ImabetsuDocument;
    return fetchMeetingData(doc, municipalityCode);
  },
};
