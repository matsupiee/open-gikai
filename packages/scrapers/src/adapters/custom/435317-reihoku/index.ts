/**
 * 苓北町議会 -- ScraperAdapter 実装
 *
 * サイト: https://reihoku-kumamoto.jp/
 * 自治体コード: 435317
 *
 * 苓北町は公式サイトで PDF を直接公開しており、
 * 単一の一覧ページから全 PDF URL を収集する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type ReihokuDetailParams } from "./detail";
import { fetchPdfList } from "./list";

export const adapter: ScraperAdapter = {
  name: "435317",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        pdfUrl: r.pdfUrl,
        meetingType: r.meetingType,
        year: r.year,
      } satisfies ReihokuDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as ReihokuDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
