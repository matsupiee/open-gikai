/**
 * 蔵王町議会（宮城県）会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.zao.miyagi.jp/kurashi_guide/gikai_senkyo/gikai/gijiroku/index.html
 * 自治体コード: 043010
 *
 * PDF 公開（令和7年以降）と HTML フレームセット公開（平成23年〜令和6年）の混在形式。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "043010",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams:
        m.type === "pdf"
          ? {
              type: "pdf",
              pdfUrl: m.pdfUrl,
              title: m.title,
              sessionTitle: m.sessionTitle,
              heldOn: m.heldOn,
            }
          : {
              type: "html",
              mainUrl: m.mainUrl,
              title: m.title,
              heldOn: m.heldOn,
              isGeneralQuestion: m.isGeneralQuestion,
            },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as
      | {
          type: "pdf";
          pdfUrl: string;
          title: string;
          sessionTitle: string;
          heldOn: string;
        }
      | {
          type: "html";
          mainUrl: string;
          title: string;
          heldOn: string | null;
          isGeneralQuestion: boolean;
        };

    return fetchMeetingData(params, municipalityId);
  },
};
