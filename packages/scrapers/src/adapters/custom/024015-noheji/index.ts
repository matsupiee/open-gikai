/**
 * 野辺地町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.noheji.aomori.jp/life/chosei/gikai/2787
 * 自治体コード: 024015
 *
 * 野辺地町は concrete5 CMS で会議録を PDF 公開している。
 * トップページから定例会/臨時会ページ URL を収集し、各ページから PDF リンクを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";
import type { NohejiDocument } from "./list";

export const adapter: ScraperAdapter = {
  name: "024015",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        sessionTitle: doc.sessionTitle,
        linkText: doc.linkText,
        downloadUrl: doc.downloadUrl,
        sessionPageUrl: doc.sessionPageUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const doc = detailParams as unknown as NohejiDocument;
    return fetchMeetingData(doc, municipalityId);
  },
};
