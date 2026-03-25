/**
 * 深浦町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.fukaura.lg.jp/category/bunya/gikai/
 * 自治体コード: 023230
 *
 * 深浦町は議会だより PDF で一般質問の Q&A を公開している。
 * インデックスページから年度別に定例会リンクを収集し、
 * 各記事ページから一般質問 PDF を取得して発言をパースする。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "023230",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings
      .filter((m) => m.questionPdfUrls.length > 0)
      .map((m) => ({
        detailParams: {
          title: m.title,
          heldOn: m.heldOn,
          articleUrl: m.articleUrl,
          questionPdfUrls: m.questionPdfUrls,
          docId: m.docId,
        },
      }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      title: string;
      heldOn: string;
      articleUrl: string;
      questionPdfUrls: string[];
      docId: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
