/**
 * 下仁田町議会（群馬県） — ScraperAdapter 実装
 *
 * サイト: https://www.town.shimonita.lg.jp/m08/m02/index.html
 * 自治体コード: 103829
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchSessionList } from "./list";
import { fetchMeetingData, type ShimonitaDetailParams } from "./detail";

export const adapter: ScraperAdapter = {
  name: "103829",

  async fetchList({ year }): Promise<ListRecord[]> {
    const sessions = await fetchSessionList(year);

    return sessions.map((s) => ({
      detailParams: {
        title: s.title,
        heldOn: s.heldOn,
        pdfUrl: s.pdfUrl,
        meetingType: s.meetingType,
        meetingHeading: s.meetingHeading,
      } satisfies ShimonitaDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as ShimonitaDetailParams;
    return fetchMeetingData(params, municipalityId);
  },
};
