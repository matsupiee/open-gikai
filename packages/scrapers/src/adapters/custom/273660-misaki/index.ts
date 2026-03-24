/**
 * 岬町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.misaki.osaka.jp/soshiki/gikai/chogikai/gijiroku/index.html
 * 自治体コード: 273660
 *
 * 岬町は公式サイトで PDF ベースの議事録を公開しており、
 * 年度別一覧ページから各定例会・臨時会・委員会ごとの PDF をダウンロードする方式。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "273660",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        section: m.section,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      section: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
