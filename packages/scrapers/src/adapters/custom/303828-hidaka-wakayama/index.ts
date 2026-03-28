/**
 * 日高町議会（和歌山県） — ScraperAdapter 実装
 *
 * サイト: http://www.town.wakayama-hidaka.lg.jp/docs/2014090500409/
 * 自治体コード: 303828
 *
 * 日高町は会議録検索システムを導入しておらず、
 * 「議会だより」PDF を情報源として一般質問を取得する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "303828",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        pdfUrl: meeting.pdfUrl,
        title: meeting.title,
        issueNumber: meeting.issueNumber,
        meetingYear: meeting.meetingYear,
        publishYear: meeting.publishYear,
        publishMonth: meeting.publishMonth,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      issueNumber: number;
      meetingYear: number;
      publishYear: number;
      publishMonth: number;
    };

    return fetchMeetingData(params, municipalityCode);
  },
};
