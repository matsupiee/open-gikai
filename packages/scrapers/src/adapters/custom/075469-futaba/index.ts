/**
 * 双葉町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.fukushima-futaba.lg.jp/6178.htm
 * 自治体コード: 075469
 *
 * 双葉町は i-SITE PORTAL の年度別ページで PDF 会議録を公開しているため、
 * カスタムアダプターとして list/detail の 2 フェーズで処理する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { type FutabaDetailParams, buildMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export { parseTopPage, parseYearPage } from "./list";
export { classifyKind, parseHeldOnFromText, parseSpeaker, parseStatements } from "./detail";

export const adapter: ScraperAdapter = {
  name: "075469",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((meeting) => ({
      detailParams: {
        title: meeting.title,
        pdfUrl: meeting.pdfUrl,
        yearPageUrl: meeting.yearPageUrl,
      } satisfies FutabaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as FutabaDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
