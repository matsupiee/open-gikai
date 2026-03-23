/**
 * 北広島町議会 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kitahiroshima.lg.jp/site/gikai/list98.html
 * 自治体コード: 343692
 *
 * 広島県北広島町の議会会議録を収集するカスタムアダプター。
 * 注意: 北海道北広島市（コード: 012343）とは別の自治体。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { buildMeetingData } from "./detail";
import type { KitahiroshimaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "343692",

  async fetchList({ year }): Promise<ListRecord[]> {
    const items = await fetchPdfList(year);

    return items.map((item) => ({
      detailParams: {
        title: `${item.sessionLabel}会議録（${item.heldOn}）`,
        heldOn: item.heldOn,
        pdfUrl: item.pdfUrl,
        meetingType: item.meetingType,
        sessionLabel: item.sessionLabel,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as KitahiroshimaDetailParams;
    return buildMeetingData(params, municipalityId);
  },
};
