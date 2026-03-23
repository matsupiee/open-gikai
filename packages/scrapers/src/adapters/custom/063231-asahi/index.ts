/**
 * 朝日町教育委員会 定例会会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.asahi.yamagata.jp/portal/soshikinogoannai/kyoikubunkaka/gakkokyoikukakari/1_1/1/9645.html
 * 自治体コード: 063231
 *
 * 朝日町教育委員会は独自ページで PDF ベースの会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseListPage, toHeldOn } from "./list";
export { parseStatements, detectRole } from "./detail";

export const adapter: ScraperAdapter = {
  name: "063231",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        sessionName: m.sessionName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      sessionName: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
