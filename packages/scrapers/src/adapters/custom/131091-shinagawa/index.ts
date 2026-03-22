/**
 * 品川区議会 会議録検索システム — ScraperAdapter 実装
 *
 * サイト: https://kaigiroku.city.shinagawa.tokyo.jp/
 * 自治体コード: 131091
 *
 * 品川区は独自の会議録検索システムを使用しており、
 * 既存の汎用アダプター（kensakusystem, gijiroku_com 等）では対応できないため、
 * カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseListPage } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "shinagawa_kaigiroku",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        documentId: doc.documentId,
        title: doc.title,
        heldOn: doc.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { documentId, title, heldOn } = detailParams as {
      documentId: string;
      title: string;
      heldOn: string;
    };
    return fetchMeetingData({ documentId, title, heldOn }, municipalityId);
  },
};
