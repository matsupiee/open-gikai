/**
 * 川崎町議会（宮城県）会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kawasaki.miyagi.jp/site/gikai/
 * 自治体コード: 043249
 *
 * 令和3年以降は PDF 公開、令和2年以前は HTML 直接公開の混在形式のため
 * カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "043249",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: m.type === "pdf"
        ? {
            type: "pdf",
            pdfUrl: m.pdfUrl,
            title: m.title,
            sessionTitle: m.sessionTitle,
            heldOn: m.heldOn,
          }
        : {
            type: "html",
            pageUrl: m.pageUrl,
            title: m.title,
            heldOn: m.heldOn,
          },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as
      | { type: "pdf"; pdfUrl: string; title: string; sessionTitle: string; heldOn: string }
      | { type: "html"; pageUrl: string; title: string; heldOn: string | null };

    return fetchMeetingData(params, municipalityCode);
  },
};
