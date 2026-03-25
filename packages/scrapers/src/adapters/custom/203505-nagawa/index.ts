/**
 * 長和町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.nagawa.nagano.jp/gyoseijoho/gikai/teireikai-rinjikai/1/index.html
 * 自治体コード: 203505
 *
 * 長和町は SMART CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから年度別ページ URL を収集し、
 * 各年度別ページから PDF リンクを抽出する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData, type NagawaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "203505",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchDocumentList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        sessionKey: s.sessionKey,
      } satisfies NagawaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as NagawaDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
