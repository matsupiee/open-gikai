/**
 * 七飯町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.nanae.hokkaido.jp/hotnews/category/471.html
 * 自治体コード: 013374
 *
 * 七飯町は自治体公式サイトで PDF 形式の会議録を公開しており、
 * 一覧ページ → 詳細ページ → PDF の2階層構造でリンクを動的に取得する。
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "013374",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
        detailUrl: m.detailUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      meetingType: string;
      detailUrl: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
