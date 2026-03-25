/**
 * 若桜町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.wakasa.tottori.jp/soshikikarasagasu/gikaijimukyoku/1/1/524.html
 * 自治体コード: 313254
 *
 * 若桜町は町公式サイトで PDF を直接公開しており、
 * 全会議録が 1 つの HTML ページにまとまっている。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "313254",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
        sessionTitle: m.sessionTitle,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      meetingType: string;
      sessionTitle: string;
    };
    return fetchMeetingData(
      {
        pdfUrl: params.pdfUrl,
        title: params.title,
        heldOn: params.heldOn,
        meetingType: params.meetingType,
        sessionTitle: params.sessionTitle,
      },
      municipalityId,
    );
  },
};
