/**
 * 久万高原町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.kumakogen.jp/site/gikai/list149.html
 * 自治体コード: 383864
 *
 * 久万高原町は独自 CMS で会議録を PDF 形式のみで公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで3段階クロール（年度一覧 → 年度別会議一覧 → 個別会議ページ）を行い、
 * PDF リンクを収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type KumakogenDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "383864",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        meetingPageId: s.meetingPageId,
      } satisfies KumakogenDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KumakogenDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
