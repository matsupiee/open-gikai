/**
 * 長野原町議会（群馬県） — ScraperAdapter 実装
 *
 * サイト: https://www.town.naganohara.gunma.jp/www/genre/1461123870183/index.html
 * 自治体コード: 104248
 *
 * 長野原町は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでトップページ → 年度別ページの 2 段階クロールを行い、
 * detail フェーズで PDF をダウンロードしてテキスト抽出・発言分割を行う。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";
import { BASE_ORIGIN, TOP_PAGE_PATH } from "./shared";

export const adapter: ScraperAdapter = {
  name: "104248",

  async fetchList({ year }): Promise<ListRecord[]> {
    const topUrl = `${BASE_ORIGIN}${TOP_PAGE_PATH}`;
    const meetings = await fetchMeetingList(topUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      meetingType: "plenary" | "extraordinary" | "committee";
    };
    return fetchMeetingData(params, municipalityId);
  },
};
