/**
 * 佐川町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.sakawa.lg.jp/
 * 自治体コード: 394025
 *
 * 佐川町は公式サイトに PDF 形式で会議録を公開しており、
 * 議事録一覧ページ（hdnKey=1076）→ 年度別ページ → PDF の
 * 2段階クロールでスクレイピングする。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "394025",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        meetingName: m.meetingName,
        linkText: m.linkText,
        pageId: m.pageId,
        fileId: m.fileId,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      meetingName: string;
      linkText: string;
      pageId: string;
      fileId: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
