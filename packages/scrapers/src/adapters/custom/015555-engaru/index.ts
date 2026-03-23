/**
 * 遠軽町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://engaru.jp/life/page.php?id=398
 * 自治体コード: 015555
 *
 * 遠軽町は自治体公式サイトで PDF 形式の会議録を単一ページに全件公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "015555",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        category: m.category,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      category: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
