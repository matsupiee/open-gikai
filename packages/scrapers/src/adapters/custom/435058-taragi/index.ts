/**
 * 多良木町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.taragi.lg.jp/
 * 自治体コード: 435058
 *
 * 多良木町は町公式サイトで PDF を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 * 一覧ページ → 詳細ページ → PDF という 2 段階構造。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "435058",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        detailId: m.detailId,
        title: m.title,
        pdfUrl: m.pdfUrl,
        heldOn: m.heldOn,
        detailUrl: m.detailUrl,
        externalId: m.externalId,
        meetingType: m.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      detailId: string;
      title: string;
      pdfUrl: string;
      heldOn: string;
      detailUrl: string;
      externalId: string;
      meetingType: "plenary" | "committee" | "extraordinary";
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
