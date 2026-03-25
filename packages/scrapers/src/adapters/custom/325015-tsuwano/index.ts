/**
 * 津和野町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tsuwano.lg.jp/www/contents/1707956534539/index.html
 * 自治体コード: 325015
 *
 * 津和野町は公式サイト上で会議録を PDF ファイルとして直接提供しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "325015",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        title: m.title,
        pdfUrl: m.pdfUrl,
        heldOn: m.heldOn,
        filename: m.filename,
        year: m.year,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      title: string;
      pdfUrl: string;
      heldOn: string | null;
      filename: string;
      year: number;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
