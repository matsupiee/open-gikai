/**
 * 草津町議会（群馬県） — ScraperAdapter 実装
 *
 * サイト: https://www.town.kusatsu.gunma.jp/www/contents/1654156951891/index.html
 * 自治体コード: 104264
 *
 * 草津町は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで単一の一覧ページから PDF URL を収集し、
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type KusatsuDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "104264",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
      } satisfies KusatsuDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KusatsuDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
