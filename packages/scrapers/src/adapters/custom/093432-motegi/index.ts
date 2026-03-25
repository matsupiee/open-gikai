/**
 * 茂木町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.motegi.tochigi.jp/motegi/nextpage.php?cd=17800&syurui=1
 * 自治体コード: 093432
 *
 * 茂木町は町独自 CMS により PDF 形式で会議録を公開しており、
 * 既存の汎用アダプターでは対応できないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "093432",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingId: m.meetingId,
        pdfFileName: m.pdfFileName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string | null;
      meetingId: string;
      pdfFileName: string;
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
