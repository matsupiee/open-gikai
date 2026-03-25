/**
 * 境町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ibaraki-sakai.lg.jp/page/dir000145.html
 * 自治体コード: 085464
 *
 * 境町は町独自ページで一般質問会議録 PDF を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 * 議員ごとに個別 PDF ファイルが提供される。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "085464",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchMeetingList(baseUrl, year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        questioner: r.questioner,
        pageUrl: r.pageUrl,
        pdfUrl: r.pdfUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      title: string;
      questioner: string;
      pageUrl: string;
      pdfUrl: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
