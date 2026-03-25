/**
 * 宝達志水町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.hodatsushimizu.jp/soshiki/gikaijimukyoku/2/index.html
 * 自治体コード: 173860
 *
 * 宝達志水町は町公式サイトで年度別に PDF を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "173860",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        session: m.session,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      session: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
