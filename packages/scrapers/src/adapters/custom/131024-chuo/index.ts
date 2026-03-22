/**
 * 中央区議会 会議録検索システム — ScraperAdapter 実装
 *
 * サイト: https://www.kugikai.city.chuo.lg.jp/kaigiroku/index.cgi
 * 自治体コード: 131024
 *
 * 中央区は独自の CGI ベース会議録検索システムを使用しており、
 * 既存の汎用アダプター（kensakusystem, gijiroku_com 等）では対応できないため、
 * カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseListPage, extractDateFromTitle } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "131024",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(baseUrl, year);

    return documents
      .filter((doc) => doc.heldOn !== null)
      .map((doc) => ({
        detailParams: {
          detailUrl: doc.url,
          title: doc.title,
          heldOn: doc.heldOn!,
        },
      }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      detailUrl: string;
      title: string;
      heldOn: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
