/**
 * 外ヶ浜町議会 — ScraperAdapter 実装
 *
 * サイト: http://www.town.sotogahama.lg.jp/gyosei/gikai/
 * 自治体コード: 023078
 *
 * 外ヶ浜町は会議録をオンライン公開しておらず、「議会だより」（PDF）のみ提供されている。
 * gikai_dayori.html から PDF リンクを収集し、PDF テキストを段落単位で格納する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";
import type { SotogahamaDocument } from "./list";

export const adapter: ScraperAdapter = {
  name: "023078",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        type: doc.type,
        issue: doc.issue,
        heldOn: doc.heldOn,
        pdfUrl: doc.pdfUrl,
        filename: doc.filename,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const doc = detailParams as unknown as SotogahamaDocument;
    return fetchMeetingData(doc, municipalityId);
  },
};
