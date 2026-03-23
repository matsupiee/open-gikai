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
import { fetchPdfSessions } from "./list";
import { fetchMeetingDataFromPdf } from "./detail";
import type { MeetingData } from "../../../utils/types";

export const adapter: ScraperAdapter = {
  name: "134023",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchPdfSessions(year);

    return sessions.map((session) => ({
      detailParams: {
        pdfUrl: session.pdfUrl,
        filename: session.filename,
        yearMonth: session.yearMonth,
        sessionTitle: session.sessionTitle,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }): Promise<MeetingData | null> {
    const params = detailParams as {
      pdfUrl: string;
      filename: string;
      yearMonth: string;
      sessionTitle: string;
    };

    const meetings = await fetchMeetingDataFromPdf(
      { pdfUrl: params.pdfUrl, filename: params.filename, yearMonth: params.yearMonth },
      municipalityId
    );

    // sessionTitle で該当セッションの MeetingData を特定して返す
    return meetings.find((m) => m.title === `${params.sessionTitle}議決一覧`) ?? null;
  },
};
