/**
 * 下市町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.shimoichi.lg.jp/
 * 自治体コード: 294438
 *
 * 下市町は年別カテゴリページで各会議の概要ページを公開しているが、
 * 会議録全文（PDF・テキスト）は提供されていない。
 * 議決事項と一般質問テーマを収集対象とする。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingRefs } from "./list";

export const adapter: ScraperAdapter = {
  name: "294438",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const refs = await fetchMeetingRefs(baseUrl, year);

    return refs.map((ref) => ({
      detailParams: {
        pageUrl: ref.pageUrl,
        numericId: ref.numericId,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pageUrl: string;
      numericId: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
