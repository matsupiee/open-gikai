/**
 * 周防大島町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.suo-oshima.lg.jp/site/gikai/
 * 自治体コード: 353051
 *
 * 会議録は PDF 形式で提供。一覧ページ (list18-56.html) から全詳細ページ URL を収集し、
 * 各詳細ページから PDF リンクを取得してテキスト抽出を行う。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { buildMeetingData, type SuooshimaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "353051",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchMeetingList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        detailUrl: s.detailUrl,
      } satisfies SuooshimaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as SuooshimaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
