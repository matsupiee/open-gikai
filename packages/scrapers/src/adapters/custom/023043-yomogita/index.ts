/**
 * 蓬田村議会 — ScraperAdapter 実装
 *
 * サイト: https://www.vill.yomogita.lg.jp/sonsei/gikai/gijiroku.html
 * 自治体コード: 023043
 *
 * 単一ページ（gijiroku.html）に全年度分の会議録 PDF リンクが掲載されている。
 * 年度ごとに <h2> で区切られ、PDF リンクから会議名と URL を収集する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";
import type { YomogitaMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "023043",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        title: meeting.title,
        year: meeting.year,
        heldOn: meeting.heldOn,
        pdfUrl: meeting.pdfUrl,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const meeting = detailParams as unknown as YomogitaMeeting;
    return fetchMeetingData(meeting, municipalityId);
  },
};
