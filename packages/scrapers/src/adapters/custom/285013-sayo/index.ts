/**
 * 佐用町議会（兵庫県） -- ScraperAdapter 実装
 *
 * サイト: https://www.town.sayo.lg.jp/cms-sypher/www/gov/result.jsp?life_genre=157
 * 自治体コード: 285013
 *
 * 佐用町は公式サイト内で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで全件一覧ページから年度別詳細ページIDを収集し、
 * 各年度ページの PDF リンクを収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * 発言者パターンで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type SayoDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "285013",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        sessionName: s.sessionName,
      } satisfies SayoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as SayoDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
