/**
 * 江別市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.ebetsu.hokkaido.jp/site/gijiroku1/
 * 自治体コード: 012173
 *
 * 江別市は独自の HTML サイトで会議録を公開しており、
 * 既存の汎用アダプターでは対応できないため、カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseYearPageUrls, parseMeetingLinks } from "./list";
export { parseStatements, parseSpeaker, classifyKind, extractTitle } from "./detail";

export const adapter: ScraperAdapter = {
  name: "012173",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const documents = await fetchDocumentList(baseUrl, year);

    return documents.map((doc) => ({
      detailParams: {
        pageId: doc.pageId,
        url: doc.url,
        section: doc.section,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const { pageId, url, section } = detailParams as {
      pageId: string;
      url: string;
      section: string;
    };
    return fetchMeetingData({ pageId, url, section }, municipalityId);
  },
};
