/**
 * 天川村議会 会議録 -- ScraperAdapter 実装
 *
 * サイト: https://smart.discussvision.net/smart/tenant/nara/WebView/rd/council_1.html
 * 自治体コード: 294462
 *
 * 天川村議会は DiscussVision Smart（tenant/nara）による映像配信のみ提供しており、
 * テキスト形式の会議録は全期間にわたって提供されていない。
 * minute/text API は全レコードで error_code: 2004（データなし）を返すため、
 * テキストスクレイピングの対象外とする。
 *
 * 参考: docs/custom-scraping/tenkawa.md
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";

export const adapter: ScraperAdapter = {
  name: "294462",

  async fetchList(_params): Promise<ListRecord[]> {
    // テキスト会議録が存在しないため、常に空リストを返す。
    return [];
  },

  async fetchDetail(_params) {
    // fetchList が常に空を返すため、このメソッドは呼ばれない。
    return null;
  },
};
