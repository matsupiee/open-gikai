/**
 * 座間味村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.zamami.okinawa.jp/info/kaigiroku.html
 * 自治体コード: 473545
 *
 * 座間味村は自治体公式サイトで PDF ベースの議事録を公開しており、
 * 単一 HTML ページにすべての PDF リンクが掲載されている。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "473545",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        category: m.category,
        pdfKey: m.pdfKey,
        issueNumber: m.issueNumber,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      category: string;
      pdfKey: string;
      issueNumber: number | null;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
