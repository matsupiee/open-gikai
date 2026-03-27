/**
 * 磐梯町議会 会議録 — ScraperAdapter 実装
 */

import type { ListRecord, ScraperAdapter } from "../../adapter"
import { fetchMeetingData, type BandaiDetailParams } from "./detail"
import { fetchMeetingList } from "./list"

export const adapter: ScraperAdapter = {
  name: "074071",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year)

    return meetings.map((meeting) => ({
      detailParams: {
        title: meeting.title,
        openUrl: meeting.openUrl,
      } satisfies BandaiDetailParams,
    }))
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    return fetchMeetingData(
      detailParams as unknown as BandaiDetailParams,
      municipalityCode,
    )
  },
}

