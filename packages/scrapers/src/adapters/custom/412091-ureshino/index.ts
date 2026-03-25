/**
 * 嬉野市議会 — ScraperAdapter 実装
 *
 * サイト: https://www.city.ureshino.lg.jp/gikai/hokoku/394.html
 * 自治体コード: 412091
 *
 * 嬉野市は独自 CMS で会議録を PDF 形式で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズでトップページ → 年度ページ → 会議別ページを辿り、
 * 日別の PDF URL を収集する。
 * detail フェーズでは収集済みパラメータから MeetingData を組み立てる。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { buildMeetingData, type UreshinoDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "412091",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(baseUrl, year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        heldOn: r.heldOn,
        pdfUrl: r.pdfUrl,
        meetingType: r.meetingType,
        sessionPagePath: r.sessionPagePath,
      } satisfies UreshinoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as UreshinoDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
