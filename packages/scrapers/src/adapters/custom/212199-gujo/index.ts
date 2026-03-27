/**
 * 郡上市議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.city.gujo.gifu.jp/admin/gikai_kaigiroku/
 * 自治体コード: 212199
 *
 * 郡上市は公式サイト上で年度ごとの PDF 会議録を公開している。
 * 一覧トップから年度ページを辿り、各会期日ごとの PDF を取得する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchDocumentList } from "./list";

export const adapter: ScraperAdapter = {
  name: "212199",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(baseUrl, year);

    return meetings.map((meeting) => ({
      detailParams: {
        title: meeting.title,
        sessionTitle: meeting.sessionTitle,
        pdfUrl: meeting.pdfUrl,
        heldOn: meeting.heldOn,
        meetingType: meeting.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      title: string;
      sessionTitle: string;
      pdfUrl: string;
      heldOn: string;
      meetingType: "plenary" | "committee" | "extraordinary";
    };
    return fetchMeetingData(params, municipalityCode);
  },
};
