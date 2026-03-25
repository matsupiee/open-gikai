/**
 * 大洗町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.oarai.lg.jp/oaraigikai/
 * 自治体コード: 083097
 *
 * 大洗町は HTML ベースの会議検索機能を提供しておらず、会議録は PDF のみの公開である。
 * 議事録トップページから PDF リンクを収集し、PDF からテキストを抽出して発言データを生成する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfRecordList } from "./list";
import { buildMeetingData } from "./detail";
import type { OaraiPdfRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "083097",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfRecordList(baseUrl, year);

    return records.map((record) => ({
      detailParams: record as unknown as Record<string, unknown>,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const record = detailParams as unknown as OaraiPdfRecord;
    return buildMeetingData(record, municipalityCode);
  },
};
