/**
 * 木古内町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.kikonai.hokkaido.jp/gikai/kaigiroku/
 * 自治体コード: 013340
 *
 * 木古内町は自治体公式サイトで PDF 形式の会議録を公開しており、
 * 3 階層（トップ→年度→会議種別→PDF）の構造でリンクを動的に取得する。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "013340",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        category: m.category,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      category: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
