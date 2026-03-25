/**
 * 美浦村議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/
 * 自治体コード: 084425
 *
 * 美浦村は HTML ベースの会議検索機能を提供しておらず、会議録は PDF のみの公開である。
 * 年度別ページから PDF リンクを収集し、PDF からテキストを抽出して発言データを生成する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfRecordList } from "./list";
import { buildMeetingData } from "./detail";
import type { MihoPdfRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "084425",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const records = await fetchPdfRecordList(baseUrl, year);

    return records.map((record) => ({
      detailParams: record as unknown as Record<string, unknown>,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const record = detailParams as unknown as MihoPdfRecord;
    return buildMeetingData(record, municipalityCode);
  },
};
