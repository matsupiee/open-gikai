/**
 * 御宿町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.onjuku.chiba.jp/sub5/4/gikai/gijiroku/
 * 自治体コード: 124435
 *
 * 御宿町は公式サイトで PDF を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで年度別ページから PDF URL を収集する。
 * detail フェーズでは PDF をダウンロードし MeetingData を組み立てる。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData, type OnjukuDetailParams } from "./detail";
import { fetchPdfList } from "./list";

export const adapter: ScraperAdapter = {
  name: "124435",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        pdfUrl: r.pdfUrl,
        meetingType: r.meetingType,
        yearPageUrl: r.yearPageUrl,
      } satisfies OnjukuDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as OnjukuDetailParams;
    return buildMeetingData(params, municipalityCode);
  },
};
