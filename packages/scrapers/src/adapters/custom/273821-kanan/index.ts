/**
 * 河南町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.kanan.osaka.jp/gyoseijoho/gikai/1/index.html
 * 自治体コード: 273821
 *
 * 河南町は公式サイトで PDF ベースの議事録を公開しており、
 * 会議録検索システムが未導入のため、カスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "273821",

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
      heldOn: string | null;
      section: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
