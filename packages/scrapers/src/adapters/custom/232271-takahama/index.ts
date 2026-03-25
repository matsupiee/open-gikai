/**
 * 高浜市議会 — ScraperAdapter 実装
 *
 * サイト: https://www.city.takahama.lg.jp/site/gikai/1529.html
 * 自治体コード: 232271
 *
 * 高浜市は自治体公式サイト上で PDF 形式の会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで定例会・臨時会・委員会・特別委員会の各ページから
 * PDF リンクを収集し、detail フェーズで PDF テキストを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingLinks } from "./list";
import { buildMeetingData, type TakahamaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "232271",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingLinks(year);

    return meetings.map((m) => ({
      detailParams: {
        title: m.title,
        pdfUrl: m.pdfUrl,
        meetingType: m.meetingType,
        heldOn: m.heldOn,
        sourceUrl: m.sourceUrl,
        externalId: m.externalId,
      } satisfies TakahamaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as TakahamaDetailParams;
    return await buildMeetingData(params, municipalityCode);
  },
};
