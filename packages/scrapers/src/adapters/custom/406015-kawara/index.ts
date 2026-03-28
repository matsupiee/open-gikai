/**
 * 香春町議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.kawara.fukuoka.jp/110/
 * 自治体コード: 406015
 *
 * 香春町議会は会議録検索システムを導入しておらず、
 * 公開されているのは議決結果 PDF のみで会議録本文は存在しない。
 * スクレイピング対象となる会議録がないため、常に空リストを返す。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";

export const adapter: ScraperAdapter = {
  name: "406015",

  async fetchList(_params): Promise<ListRecord[]> {
    return [];
  },

  async fetchDetail(_params) {
    return null;
  },
};
