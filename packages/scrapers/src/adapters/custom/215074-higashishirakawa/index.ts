/**
 * 東白川村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.higashishirakawa.gifu.jp/sonsei/gikai/kaigiroku/
 * 自治体コード: 215074
 *
 * 東白川村は公式サイト上に PDF ベースの議事録を単一ページで公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "215074",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        sessionType: m.sessionType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      sessionType: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
