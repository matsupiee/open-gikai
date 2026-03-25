/**
 * 諸塚村議会 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.morotsuka.miyazaki.jp/
 * 自治体コード: 454290
 *
 * 諸塚村は会議録検索システムを持たず、議会だより PDF が唯一の公開資料。
 * 最新号ページと過去号一覧ページの両方から PDF URL を収集し、
 * PDF テキストの問/答形式を解析する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "454290",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        year: m.year,
        month: m.month,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      year: number;
      month: number;
    };
    return fetchMeetingData(
      {
        pdfUrl: params.pdfUrl,
        title: params.title,
        year: params.year,
        month: params.month,
      },
      municipalityCode,
    );
  },
};
