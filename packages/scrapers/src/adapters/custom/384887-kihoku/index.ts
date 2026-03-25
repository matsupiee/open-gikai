/**
 * 鬼北町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.kihoku.ehime.jp/site/gikai/list17-364.html
 * 自治体コード: 384887
 *
 * 鬼北町は独自 CMS による HTML 公開であり、年度別インデックスページを経由して
 * PDF で会議録を提供しているため、カスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { buildMeetingData } from "./detail";
import type { KihokuDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "384887",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(year);

    return records.map((record) => ({
      detailParams: {
        title: record.linkText,
        heldOn: record.heldOn,
        pdfUrl: record.pdfUrl,
        meetingType: record.meetingKind === "定例会" ? "plenary" : "extraordinary",
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KihokuDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
