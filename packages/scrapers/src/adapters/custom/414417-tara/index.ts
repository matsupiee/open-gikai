/**
 * 太良町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tara.lg.jp/chosei/_1010/_1414.html
 * 自治体コード: 414417
 *
 * 太良町は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでトップページ → 年度ページを辿り、
 * 会議ごとの PDF URL を収集する。
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { buildMeetingData, type TaraDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "414417",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(baseUrl, year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        heldOn: r.heldOn,
        pdfUrl: r.pdfUrl,
        meetingType: r.meetingType,
        yearPageUrl: r.yearPageUrl,
      } satisfies TaraDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as TaraDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
