/**
 * 下條村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.vill-shimojo.jp/gyousei/simojomura_songikai/
 * 自治体コード: 204111
 *
 * 下條村は会議録検索システムを導入しておらず、会議録テキストは公開されていない。
 * 議会だより PDF を情報源として会議情報を取得する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "204111",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

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
      heldOn: string;
      section: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
