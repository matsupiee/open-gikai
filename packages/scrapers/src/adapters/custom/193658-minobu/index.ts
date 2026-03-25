/**
 * 身延町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.minobu.lg.jp/site/gikai/
 * 自治体コード: 193658
 *
 * 身延町は町公式サイト内で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページ (/page/1455.html) から全 PDF リンクを収集し、
 * 対象年度に絞り込む。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import {
  buildMeetingData,
  type MinobuDetailParams,
} from "./detail";

export const adapter: ScraperAdapter = {
  name: "193658",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
      } satisfies MinobuDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MinobuDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
