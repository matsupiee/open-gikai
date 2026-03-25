/**
 * 北方町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kitagata.gifu.jp/soshiki/gikai/1/2/2/index.html
 * 自治体コード: 214213
 *
 * 北方町は公式サイトで年度別に会議録 PDF を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "214213",

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
