/**
 * 生坂村議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.village.ikusaka.nagano.jp/gikai/teireikai.html
 * 自治体コード: 204480
 *
 * 生坂村は公式サイトで PDF を直接公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 *
 * list フェーズで teireikai.html から PDF URL を収集する。
 * detail フェーズでは PDF をダウンロードし MeetingData を組み立てる。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData } from "./detail";
import { fetchPdfList } from "./list";

export const adapter: ScraperAdapter = {
  name: "204480",

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
