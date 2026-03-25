/**
 * 越前町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.echizen.fukui.jp/chousei/04/06/index.html
 * 自治体コード: 184233
 *
 * 越前町は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから全会議録のリンクを収集し、
 * detail フェーズで各詳細ページの PDF を取得してテキストを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingLinks } from "./list";
import { buildMeetingData, type EchizenDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "184233",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingLinks(year);

    return meetings.map((m) => ({
      detailParams: {
        title: m.title,
        detailUrl: m.detailUrl,
        pagePath: m.pagePath,
        pageId: m.pageId,
        meetingType: m.meetingType,
        generalQuestion: m.generalQuestion,
        heldOn: m.heldOn,
      } satisfies EchizenDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as EchizenDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
