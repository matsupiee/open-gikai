/**
 * 上小阿仁村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.kamikoani.akita.jp/menu/6
 * 自治体コード: 053279
 *
 * 上小阿仁村は村公式サイトで年度別に PDF 形式の会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "053279",

  async fetchList({ year }): Promise<ListRecord[]> {
    const pdfs = await fetchPdfList(year);

    return pdfs.map((pdf) => ({
      detailParams: {
        pdfUrl: pdf.pdfUrl,
        meetingTitle: pdf.meetingTitle,
        partTitle: pdf.partTitle,
        heldOn: pdf.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      meetingTitle: string;
      partTitle: string;
      heldOn: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
