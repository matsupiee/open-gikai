/**
 * 中野区議会 議事録検索システム — ScraperAdapter 実装
 *
 * サイト: https://kugikai-nakano.jp/
 * 自治体コード: 131148
 *
 * 中野区は独自の議事録検索システム（Shift_JIS、gijiroku_id ベース）を使用しており、
 * 既存の汎用アダプター（kensakusystem, gijiroku_com 等）では対応できないため、
 * カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseListPage } from "./list";
export { parseStatements, parseSpeaker, classifyKind, detectCommitteeSpeaker } from "./detail";

export const adapter: ScraperAdapter = {
  name: "131148",

  async fetchList({ year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(year);

    return documents.map((doc) => ({
      detailParams: {
        gijirokuId: doc.gijirokuId,
        title: doc.title,
        heldOn: doc.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { gijirokuId, title, heldOn } = detailParams as {
      gijirokuId: string;
      title: string;
      heldOn: string;
    };
    return fetchMeetingData({ gijirokuId, title, heldOn }, municipalityId);
  },
};
