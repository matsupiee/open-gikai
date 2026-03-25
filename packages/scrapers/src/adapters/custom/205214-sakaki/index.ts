/**
 * 坂城町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.sakaki.nagano.jp/site/gikai/
 * 自治体コード: 205214
 *
 * 坂城町は自治体 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで会議録一覧ページから年度別ページ URL を収集し、
 * 各年度別ページから詳細ページ URL を抽出し、
 * 各詳細ページから「全ページ一括ダウンロード」PDF リンクを収集する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { buildMeetingData, type SakakiDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "205214",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchDocumentList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        year: s.year,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        detailUrl: s.detailUrl,
        sessionKey: s.sessionKey,
      } satisfies SakakiDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as SakakiDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
