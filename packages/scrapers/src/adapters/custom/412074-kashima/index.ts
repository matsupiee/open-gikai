/**
 * 鹿島市議会 — ScraperAdapter 実装
 *
 * サイト: https://www.city.saga-kashima.lg.jp/main/107.html
 * 自治体コード: 412074
 *
 * 鹿島市は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでトップページ → 過去ログページ → 年度ページを辿り、
 * セッション日ごとの PDF URL を収集する。
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { buildMeetingData, type KashimaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "412074",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(baseUrl, year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        heldOn: r.heldOn,
        pdfUrl: r.pdfUrl,
        meetingType: r.meetingType,
        yearPagePath: r.yearPagePath,
      } satisfies KashimaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as KashimaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
