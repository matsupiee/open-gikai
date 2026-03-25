/**
 * 大島町議会 議案審議結果報告 — ScraperAdapter 実装
 *
 * サイト: https://www.town.oshima.tokyo.jp/soshiki/gikaijim/gikai-kekka.html
 * 自治体コード: 133612
 *
 * 大島町は議案等の審議・決定結果報告を PDF で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 * PDF はスキャン画像のためテキストレイヤーがなく、発言データの取得は困難。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "133612",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        year: m.year,
        month: m.month,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      year: number;
      month: number | null;
    };
    return fetchMeetingData(
      {
        pdfUrl: params.pdfUrl,
        title: params.title,
        year: params.year,
        month: params.month,
      },
      municipalityId
    );
  },
};
