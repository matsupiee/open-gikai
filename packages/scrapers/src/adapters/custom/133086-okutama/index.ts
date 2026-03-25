/**
 * 奥多摩町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.okutama.tokyo.jp/gyosei/8/okutamachogikai/kaigiroku/index.html
 * 自治体コード: 133086
 *
 * SMART CMS による年度別ページ + PDF ファイル公開。
 * index.tree.json API で年度ページ一覧を取得し、
 * 各年度ページから PDF リンクを収集して発言データを構築する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "133086",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      meetingType: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
