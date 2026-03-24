/**
 * 辰野町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.tatsuno.lg.jp/gyosei/choseijoho/tatsunochogikai/gikaigijiroku/index.html
 * 自治体コード: 203823
 *
 * 辰野町は自治体公式サイトで年度別ページに PDF ファイルを直接掲載している。
 * 検索システムがないため、トップページ → 年度ページ → PDF という
 * 2段階クロールでデータを取得する。
 *
 * list フェーズでトップページから年度別ページ URL を収集し、
 * 各年度ページから PDF リンク一覧を取得する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { buildMeetingData, type TatsunoDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "203823",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        sessionKey: s.sessionKey,
      } satisfies TatsunoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as TatsunoDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
