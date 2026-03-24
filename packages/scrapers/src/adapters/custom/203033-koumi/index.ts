/**
 * 小海町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.koumi-town.jp/office2/archives/gikai/
 * 自治体コード: 203033
 *
 * 小海町は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで会議録一覧ページ (post-167.html) から
 * h3 見出しを解析して各会議の PDF URL を収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type KoumiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "203033",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        sessionKey: s.sessionKey,
      } satisfies KoumiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as KoumiDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
