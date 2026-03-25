/**
 * 忠岡町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.tadaoka.osaka.jp/gyousei/gikai/2110.html
 * 自治体コード: 273414
 *
 * 忠岡町は公式サイトで PDF ベースの議事録を公開しており、
 * 一覧ページから詳細ページを経由して各会議の PDF をダウンロードする方式。
 * 一部の臨時会は一覧ページから直接 PDF にリンクされている。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "273414",

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
