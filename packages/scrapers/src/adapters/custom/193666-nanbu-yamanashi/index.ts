/**
 * 山梨県南部町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.nanbu.yamanashi.jp/kakuka/gikai/kaigiroku.html
 * 自治体コード: 193666
 *
 * 南部町（山梨県）は町公式サイト内で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページ (kaigiroku.html) から全 PDF リンクを収集し、
 * 対象年度に絞り込む。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import {
  buildMeetingData,
  type NanbuYamanashiDetailParams,
} from "./detail";

export const adapter: ScraperAdapter = {
  name: "193666",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(baseUrl, year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
      } satisfies NanbuYamanashiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as NanbuYamanashiDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
