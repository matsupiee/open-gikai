/**
 * 土庄町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tonosho.kagawa.jp/gyosei/soshiki/gikai/chogikai/kaigiroku/index.html
 * 自治体コード: 373222
 *
 * 土庄町は Smart CMS による HTML 公開で PDF ベースの議事録を提供している。
 * 新フォーマット（令和3年〜）と旧フォーマット（令和2年以前）の2種類の構造を持つため、
 * カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseReiwaIndexPage, parseMeetingPage, parseLegacyYearPage } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "373222",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingName: m.meetingName,
        year: m.year,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      meetingName: string;
      year: number;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
