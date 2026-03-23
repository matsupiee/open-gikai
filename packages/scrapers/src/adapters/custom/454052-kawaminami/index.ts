/**
 * 川南町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.kawaminami.miyazaki.jp/site/gikai/
 * 自治体コード: 454052
 *
 * 川南町は自治体公式サイト内で PDF 形式の会議録を公開しており、
 * 既存の汎用アダプターでは対応できないため、カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfRecordList } from "./list";
import { buildMeetingData } from "./detail";
import type { KawaminamiPdfRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "454052",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfRecordList(baseUrl, year);

    return records.map((record) => ({
      detailParams: record as unknown as Record<string, unknown>,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const record = detailParams as unknown as KawaminamiPdfRecord;
    return buildMeetingData(record, municipalityId);
  },
};
