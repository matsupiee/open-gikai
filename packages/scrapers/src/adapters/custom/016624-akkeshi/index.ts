/**
 * 厚岸町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.akkeshi-town.jp/chogikai/minutes/
 * 自治体コード: 016624
 *
 * 厚岸町は年度別ディレクトリ形式で PDF 会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "016624",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        sessionName: m.sessionName,
        category: m.category,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      sessionName: string;
      category: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
