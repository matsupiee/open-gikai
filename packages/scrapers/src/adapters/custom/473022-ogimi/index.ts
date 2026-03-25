/**
 * 大宜味村議会 会議録 — ScraperAdapter 実装
 *
 * サイト: http://ogimi-gikai.sakura.ne.jp/site/%E4%BC%9A%E8%AD%B0%E9%8C%B2/
 * 自治体コード: 473022
 *
 * 会議録一覧ページから PDF URL を収集し、各ファイルをダウンロード・
 * テキスト抽出して発言データを生成する。
 *
 * - 全年度・全会議が単一ページに掲載（ページネーションなし）
 * - PDF 形式のみ
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";
import type { OgimiMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "473022",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        fileUrl: meeting.fileUrl,
        title: meeting.title,
        year: meeting.year,
        meetingType: meeting.meetingType,
        sessionNumber: meeting.sessionNumber,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const meeting = detailParams as unknown as OgimiMeeting;
    return fetchMeetingData(meeting, municipalityCode);
  },
};
