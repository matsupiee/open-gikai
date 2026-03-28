/**
 * 剣淵町議会 会議録（議決結果）-- ScraperAdapter 実装
 *
 * サイト: https://www.town.kembuchi.hokkaido.jp/gikai/会議記録/
 * 自治体コード: 014656
 *
 * 剣淵町は全文会議録を公開しておらず、議決結果 PDF のみを掲載している。
 * 本アダプターでは PDF から議案番号・件名・議決結果を抽出して保存する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import type { KenbuchiMeeting } from "./list";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "014656",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        title: meeting.title,
        pdfUrl: meeting.pdfUrl,
        meetingType: meeting.meetingType,
        year: meeting.year,
        dateText: meeting.dateText,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    return fetchMeetingData(detailParams as unknown as KenbuchiMeeting, municipalityCode);
  },
};
