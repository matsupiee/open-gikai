/**
 * 本部町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.motobu.okinawa.jp/doc/2023103100062/
 * 自治体コード: 473081
 *
 * 会議録一覧ページから DOCX/PDF URL を収集し、各ファイルをダウンロード・
 * テキスト抽出して発言データを生成する。
 *
 * - 全年度・全会議が単一ページに掲載（ページネーションなし）
 * - 令和6年〜: DOCX 形式
 * - 平成25年〜令和5年: PDF 形式
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";
import type { MotubuMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "473081",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        fileUrl: meeting.fileUrl,
        fileType: meeting.fileType,
        title: meeting.title,
        year: meeting.year,
        heldOn: meeting.heldOn,
        meetingType: meeting.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const meeting = detailParams as unknown as MotubuMeeting;
    return fetchMeetingData(meeting, municipalityCode);
  },
};
