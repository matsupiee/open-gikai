import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";
import type { ShiriuchiMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "013331",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingType: m.meetingType,
        year: m.year,
      } satisfies ShiriuchiMeeting,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as ShiriuchiMeeting;
    return fetchMeetingData(params, municipalityId);
  },
};
