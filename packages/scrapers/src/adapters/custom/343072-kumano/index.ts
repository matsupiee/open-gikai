/**
 * 熊野町議会（広島県） — ScraperAdapter 実装
 *
 * サイト: https://www.town.kumano.hiroshima.jp/www/genre/1436489288629/index.html
 * 自治体コード: 343072
 *
 * 熊野町は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度別記事ページから PDF URL を収集し、
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type KumanoDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "343072",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
      } satisfies KumanoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as KumanoDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
