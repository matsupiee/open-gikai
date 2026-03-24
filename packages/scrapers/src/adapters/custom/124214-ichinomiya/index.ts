/**
 * 一宮町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.ichinomiya.chiba.jp/info/gikai/2/
 * 自治体コード: 124214
 *
 * 一宮町は公式サイト内で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度別ページの PDF リンクを収集し、
 * detail フェーズでは PDF をダウンロード・テキスト抽出して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type IchinomiyaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "124214",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        pageUrl: s.pageUrl,
      } satisfies IchinomiyaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as IchinomiyaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
