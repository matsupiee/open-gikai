/**
 * 南種子町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: http://www.town.minamitane.kagoshima.jp/
 * 自治体コード: 465020
 *
 * 会議録一覧ページから PDF URL を収集し、各 PDF をダウンロード・テキスト抽出して
 * 発言データを生成する。
 *
 * - HTTP のみ対応（HTTPS は接続拒否）
 * - 全年度・全会議が単一ページ（minutes.html）に掲載
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchDocumentList } from "./list";
import { fetchMeetingData } from "./detail";
import type { MinamitaneMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "465020",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchDocumentList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        year: meeting.year,
        meetingType: meeting.meetingType,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const meeting = detailParams as unknown as MinamitaneMeeting;
    return fetchMeetingData(meeting, municipalityCode);
  },
};
