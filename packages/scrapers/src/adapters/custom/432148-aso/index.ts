/**
 * 阿蘇市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.aso.kumamoto.jp/municipal/city_council/city_council/parliament_proceedings/
 * 自治体コード: 432148
 *
 * 阿蘇市は市公式サイトで PDF ベースの議事録を年度別ページに公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "432148",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        sessionName: m.sessionName,
        sessionDate: m.sessionDate,
        heldOn: m.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      sessionName: string;
      sessionDate: string;
      heldOn: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
