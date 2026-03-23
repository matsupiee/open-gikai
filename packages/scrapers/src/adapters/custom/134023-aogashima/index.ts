/**
 * 青ヶ島村議会 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.aogashima.tokyo.jp/
 * 自治体コード: 134023
 *
 * 青ヶ島村は全文会議録をオンライン公開していない。
 * 広報誌（PDF）内の議決一覧から議案番号・議決結果・議案名を収集する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchPdfList } from "./list";
import { fetchMeetingDataFromPdf } from "./detail";
import type { MeetingData } from "../../../utils/types";

export { parsePressList } from "./list";
export { parseSessions, parseBills, billsToStatements } from "./detail";

export const adapter: ScraperAdapter = {
  name: "134023",

  async fetchList({ year }): Promise<ListRecord[]> {
    const pdfs = await fetchPdfList(year);

    return pdfs.map((pdf) => ({
      detailParams: {
        pdfUrl: pdf.pdfUrl,
        filename: pdf.filename,
        yearMonth: pdf.yearMonth,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }): Promise<MeetingData | null> {
    const params = detailParams as {
      pdfUrl: string;
      filename: string;
      yearMonth: string;
    };

    const meetings = await fetchMeetingDataFromPdf(
      { pdfUrl: params.pdfUrl, filename: params.filename, yearMonth: params.yearMonth },
      municipalityId
    );

    // fetchDetail は単一の MeetingData を返す仕様。
    // 議決一覧が見つからない号は null を返す。
    // 複数セッションがある場合は最初のものを返す。
    return meetings[0] ?? null;
  },
};
