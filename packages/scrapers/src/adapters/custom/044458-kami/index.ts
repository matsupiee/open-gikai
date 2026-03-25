/**
 * 加美町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.kami.miyagi.jp/choseijoho/kamimachigikai/gijiroku/index.html
 * 自治体コード: 044458
 *
 * 加美町は SMART CMS 上で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで議事録トップページから年度ページを収集し、
 * 各年度ページの PDF リンクを抽出する。
 * detail フェーズでは PDF をダウンロード・テキスト抽出し、
 * ○マーカーで発言を分割して MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList, type KamiPdfRecord } from "./list";
import { buildMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "044458",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(baseUrl, year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        heldOn: r.heldOn,
        pdfUrl: r.pdfUrl,
        meetingType: r.meetingType,
        yearPageId: r.yearPageId,
      } satisfies KamiPdfRecord,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KamiPdfRecord;
    return buildMeetingData(params, municipalityCode);
  },
};
