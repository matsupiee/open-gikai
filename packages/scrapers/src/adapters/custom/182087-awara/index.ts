/**
 * あわら市議会 — ScraperAdapter 実装
 *
 * サイト: https://www.city.awara.lg.jp/gikai/kaigiroku/index.html
 * 自治体コード: 182087
 *
 * あわら市は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度ページから PDF リンクを収集し、
 * detail フェーズで MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { buildMeetingData, type AwaraDetailParams } from "./detail";

export { parseYearPage } from "./list";
export { buildMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "182087",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        title: m.title,
        pdfUrl: m.pdfUrl,
        meetingType: m.meetingType,
        pagePath: m.pagePath,
      } satisfies AwaraDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as AwaraDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
