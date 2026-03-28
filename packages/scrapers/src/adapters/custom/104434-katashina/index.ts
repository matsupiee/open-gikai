/**
 * 片品村議会（群馬県） — ScraperAdapter 実装
 *
 * サイト: https://www.vill.katashina.gunma.jp/gaiyou/kakuka/gikai/2016-0330-1855-38.html
 * 自治体コード: 104434
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData, type KatashinaDetailParams } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "104434",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((meeting) => ({
      detailParams: {
        title: meeting.title,
        sessionTitle: meeting.sessionTitle,
        pdfUrl: meeting.pdfUrl,
        meetingType: meeting.meetingType,
        heldOnHint: meeting.heldOnHint,
      } satisfies KatashinaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as KatashinaDetailParams;
    return fetchMeetingData(params, municipalityCode);
  },
};
