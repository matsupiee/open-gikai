/**
 * 三戸町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/index.html
 * 自治体コード: 024414
 *
 * 三戸町は町公式サイト内の静的 HTML ページに PDF ファイルを直接掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "024414",

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
