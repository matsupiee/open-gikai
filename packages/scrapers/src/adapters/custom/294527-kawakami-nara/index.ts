/**
 * 川上村議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://www.vill.kawakami.nara.jp/
 * 自治体コード: 294527
 *
 * 川上村議会は会議録検索システムを導入しておらず、公式サイト上にも
 * テキスト会議録や会議録 PDF への導線が確認できない。
 * 現時点ではスクレイピング可能な会議録データが存在しないため、
 * テキストスクレイピングの対象外とする。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";

export const adapter: ScraperAdapter = {
  name: "294527",

  async fetchList(_params): Promise<ListRecord[]> {
    // スクレイピング可能な会議録が存在しないため、常に空リストを返す。
    return [];
  },

  async fetchDetail(_params) {
    // fetchList が常に空を返すため、このメソッドは呼ばれない。
    return null;
  },
};
