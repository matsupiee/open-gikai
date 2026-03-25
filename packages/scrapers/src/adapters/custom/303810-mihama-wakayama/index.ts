/**
 * 美浜町議会（和歌山県） — ScraperAdapter 実装
 *
 * サイト: http://www.town.mihama.wakayama.jp/bunya/gikai_kaigiroku/
 * 自治体コード: 303810
 *
 * 美浜町は Joruri CMS を使用して会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度別記事ページから PDF URL を収集し、
 * detail フェーズで PDF テキストを抽出して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList, type MihamaSessionInfo } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "303810",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        yearPageUrl: s.yearPageUrl,
        meetingType: s.meetingType,
      } satisfies MihamaSessionInfo,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MihamaSessionInfo;
    return fetchMeetingData(params, municipalityCode);
  },
};
