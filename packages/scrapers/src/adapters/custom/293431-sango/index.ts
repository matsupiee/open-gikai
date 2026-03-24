/**
 * 三郷町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.sango.nara.jp/site/gikai/list7.html
 * 自治体コード: 293431
 *
 * 三郷町は公式サイトで PDF ベースの議事録を公開しており、
 * 年度別インデックスから PDF リンクを収集する。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "293431",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        section: m.section,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      section: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
