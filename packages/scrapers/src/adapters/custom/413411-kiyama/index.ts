/**
 * 基山町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kiyama.lg.jp/gikai/list01207.html
 * 自治体コード: 413411
 *
 * 基山町は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでトップページ → 年度ページ → kiji 番号詳細ページを辿り、
 * 日ごとの PDF URL を収集する。
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { buildMeetingData, type KiyamaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "413411",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(baseUrl, year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        heldOn: r.heldOn,
        pdfUrl: r.pdfUrl,
        meetingType: r.meetingType,
        detailPageUrl: r.detailPageUrl,
      } satisfies KiyamaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KiyamaDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
