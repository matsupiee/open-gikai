/**
 * 平群町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.heguri.nara.jp/site/gikai/list47-37.html
 * 自治体コード: 293423
 *
 * 平群町は公式サイトで PDF ベースの議事録を公開しており、
 * 本会議録と委員会会議録が別インデックスで管理されている。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "293423",

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

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      section: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
