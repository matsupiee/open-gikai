/**
 * 紋別市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://mombetsu.jp/gikai/minutes/
 * 自治体コード: 012190
 *
 * 紋別市は自治体公式サイトで PDF 形式の会議録を公開しており、
 * カテゴリツリー（種別→年度→content）を辿って収集する。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "012190",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingTypeLabel: m.meetingTypeLabel,
        contentUrl: m.contentUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      meetingTypeLabel: string;
      contentUrl: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
