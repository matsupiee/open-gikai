/**
 * 立科町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.tateshina.nagano.jp/gyoseijoho/gikai/kaigiroku/index.html
 * 自治体コード: 203246
 *
 * 立科町は SMART CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで 3 階層（トップ → 年度別 → 定例会）をクロールして
 * 各 PDF の URL を収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○ マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type TateshinaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "203246",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        sessionPageUrl: s.sessionPageUrl,
        pdfUrl: s.pdfUrl,
        pdfLinkText: s.pdfLinkText,
        meetingType: s.meetingType,
        sessionKey: s.sessionKey,
      } satisfies TateshinaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as TateshinaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
