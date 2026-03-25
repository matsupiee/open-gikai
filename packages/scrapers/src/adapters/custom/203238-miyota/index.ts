/**
 * 御代田町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.miyota.nagano.jp/
 * 自治体コード: 203238
 *
 * 御代田町は自治体公式サイト内の静的 HTML ページに PDF を掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでは会議録一覧 → 年度別一覧 → 定例会詳細の 3 段階クロールで
 * 各会議の PDF URL を収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData, type MiyotaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "203238",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchDocumentList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        sessionPageUrl: s.sessionPageUrl,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        sessionKey: s.sessionKey,
      } satisfies MiyotaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MiyotaDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
