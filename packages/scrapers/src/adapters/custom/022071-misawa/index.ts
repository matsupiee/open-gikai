/**
 * 三沢市議会 — ScraperAdapter 実装
 *
 * サイト: https://www.city.misawa.lg.jp/index.cfm/24,11423,118,420,html
 * 自治体コード: 022071
 *
 * 三沢市は全ての会議録を PDF 形式で公開している。
 * 全年度が単一ページに掲載されており、テーブル構造（行: 会次、列: 日目）から
 * メタデータを抽出する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData, type MisawaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "022071",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchDocumentList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        meetingType: s.meetingType,
        pdfUrl: s.pdfUrl,
      } satisfies MisawaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as MisawaDetailParams;
    return fetchMeetingData(params, municipalityCode);
  },
};
