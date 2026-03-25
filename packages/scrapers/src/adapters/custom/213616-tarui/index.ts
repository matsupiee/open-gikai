/**
 * 垂井町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tarui.lg.jp/site/gikai/list32.html
 * 自治体コード: 213616
 *
 * 垂井町は公式サイトで年度別に会議録 PDF を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "213616",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        sessionTitle: m.sessionTitle,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      sessionTitle: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
