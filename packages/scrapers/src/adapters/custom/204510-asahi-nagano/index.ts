/**
 * 朝日村議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.vill.asahi.nagano.jp/
 * 自治体コード: 204510
 *
 * 朝日村は自治体公式サイト上で年別ページに PDF 会議録を掲載しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type AsahiNaganoDetailParams } from "./detail";
import { fetchPdfList } from "./list";

export const adapter: ScraperAdapter = {
  name: "204510",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(year);

    return records.map((record) => ({
      detailParams: {
        title: record.title,
        year: record.year,
        pdfUrl: record.pdfUrl,
        meetingType: record.meetingType,
        yearPageUrl: record.yearPageUrl,
        sessionKey: record.sessionKey,
      } satisfies AsahiNaganoDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as AsahiNaganoDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
