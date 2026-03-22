/**
 * 飯塚市議会 — ScraperAdapter 実装
 *
 * サイト: https://www.city.iizuka.lg.jp/site/shigikai/
 * 自治体コード: 402052
 *
 * 飯塚市は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度インデックス → 年度ページ → 各詳細ページを辿り、
 * セッション日ごとの PDF URL を収集する。
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type IizukaDetailParams } from "./detail";

export { parseYearPages, parseMeetingLinks, extractSessionRecords } from "./list";
export { buildMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "402052",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        pageId: s.pageId,
      } satisfies IizukaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as IizukaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
