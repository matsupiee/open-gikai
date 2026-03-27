/**
 * 芦屋町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.ashiya.lg.jp/site/gikai/list433.html
 * 自治体コード: 403814
 *
 * 芦屋町は公式サイトで会議録を PDF 添付で公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { type AshiyaDetailParams, buildMeetingData } from "./detail";
import { fetchPdfRecordList } from "./list";

export const adapter: ScraperAdapter = {
  name: "403814",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfRecordList(baseUrl, year);

    return records.map((record) => ({
      detailParams: {
        title: record.title,
        pdfUrl: record.pdfUrl,
        heldOn: record.heldOn,
        meetingType: record.meetingType,
      } satisfies AshiyaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as AshiyaDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
