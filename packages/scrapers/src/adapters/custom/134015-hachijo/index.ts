/**
 * 八丈町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.hachijo.tokyo.jp/kakuka/gikai/kaigiroku.html
 * 自治体コード: 134015
 *
 * 八丈町は公式ウェブサイトで PDF ベースの議事録を単一ページに全年度分公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "134015",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

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
    return fetchMeetingData(
      {
        pdfUrl: params.pdfUrl,
        title: params.title,
        heldOn: params.heldOn,
        session: params.session,
      },
      municipalityCode
    );
  },
};
