/**
 * 山北町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.yamakita.kanagawa.jp/category/14-3-0-0-0.html
 * 自治体コード: 143642
 *
 * 山北町は公式サイト上で PDF ファイルとして年度別に会議録を公開しており、
 * 専用の会議録検索システムがないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "143642",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pageId: m.pageId,
        title: m.title,
        pdfUrl: m.pdfUrl,
        heldOn: m.heldOn,
        detailUrl: m.detailUrl,
        externalId: m.externalId,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pageId: string;
      title: string;
      pdfUrl: string;
      heldOn: string;
      detailUrl: string;
      externalId: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
