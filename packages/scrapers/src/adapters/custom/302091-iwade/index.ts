/**
 * 岩出市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.iwade.lg.jp/gikai/kaigiroku/
 * 自治体コード: 302091
 *
 * 岩出市は独自サイトで PDF 形式の会議録を公開しており、
 * 既存の汎用アダプターでは対応できないため、カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "302091",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((session) => ({
      detailParams: {
        sessionUrl: session.sessionUrl,
        sessionTitle: session.sessionTitle,
        pdfUrl: session.pdfUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const { sessionUrl, sessionTitle, pdfUrl } = detailParams as {
      sessionUrl: string;
      sessionTitle: string;
      pdfUrl: string;
    };
    return fetchMeetingData({ sessionUrl, sessionTitle, pdfUrl }, municipalityCode);
  },
};
