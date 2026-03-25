/**
 * 紀北町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.mie-kihoku.lg.jp/kakuka/gikai/kaigiroku/index.html
 * 自治体コード: 245437
 *
 * 紀北町は WordPress で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度別投稿ページから PDF リンクを収集し、
 * detail フェーズでは PDF をダウンロード・テキスト抽出して
 * ○マーカーで発言を分割し MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { buildMeetingData, type KihokuDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "245437",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(baseUrl, year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        meetingType: r.meetingType,
        pdfUrl: r.pdfUrl,
        year: r.year,
        postUrl: r.postUrl,
      } satisfies KihokuDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KihokuDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
