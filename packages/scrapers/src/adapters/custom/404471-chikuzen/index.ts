import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData, type ChikuzenDetailParams } from "./detail";
import { fetchMeetingList } from "./list";

export const adapter: ScraperAdapter = {
  name: "404471",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((meeting) => ({
      detailParams: {
        title: meeting.title,
        detailUrl: meeting.detailUrl,
        year: meeting.year,
        meetingType: meeting.meetingType,
      } satisfies ChikuzenDetailParams,
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as unknown as ChikuzenDetailParams;
    return fetchMeetingData(params, municipalityCode);
  },
};
