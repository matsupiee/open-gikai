/**
 * 田布施町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tabuse.lg.jp/site/gikai/list7.html
 * 自治体コード: 353434
 *
 * 会議録は PDF 形式で提供。3階層構造（一覧ページ → 年度別一覧ページ → 詳細ページ）から
 * 全 PDF URL を収集し、テキスト抽出を行う。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { buildMeetingData, type TabuseDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "353434",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchMeetingList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        detailUrl: s.detailUrl,
      } satisfies TabuseDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as TabuseDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
