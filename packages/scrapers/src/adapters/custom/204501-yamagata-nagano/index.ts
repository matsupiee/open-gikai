/**
 * 山形村議会（長野県） -- ScraperAdapter 実装
 *
 * サイト: https://www.vill.yamagata.nagano.jp/government/diet/minutes/
 * 自治体コード: 204501
 *
 * 山形村（長野県）は公式サイトで年度別ページに PDF を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで一覧ページから年度別ページを特定し、PDF URL を収集する。
 * detail フェーズでは PDF をダウンロードし MeetingData を組み立てる。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData } from "./detail";
import { fetchPdfList } from "./list";

export const adapter: ScraperAdapter = {
  name: "204501",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchPdfList(year);

    return records.map((r) => ({
      detailParams: {
        title: r.title,
        pdfUrl: r.pdfUrl,
        meetingType: r.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      title: string;
      pdfUrl: string;
      meetingType: string;
    };
    return buildMeetingData(params, municipalityId);
  },
};
