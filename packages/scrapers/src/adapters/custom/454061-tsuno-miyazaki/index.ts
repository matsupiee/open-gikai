/**
 * 都農町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tsuno.lg.jp/
 * 自治体コード: 454061
 *
 * 都農町はサイト全体が Angular SPA のため、HTML スクレイピングでは対応不可。
 * UrbanOS バックエンド REST API を直接叩いて PDF リンクを取得し、
 * PDF テキストを抽出して発言データを生成する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "454061",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingKind: m.meetingKind,
        session: m.session,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      meetingKind: string;
      session: number | null;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
