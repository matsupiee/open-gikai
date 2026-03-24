import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";
import type { MatsumaeMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "013315",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        title: m.title,
        year: m.year,
        heldOn: m.heldOn,
        pdfUrl: m.pdfUrl,
        meetingType: m.meetingType,
      } satisfies MatsumaeMeeting,
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as MatsumaeMeeting;
    return fetchMeetingData(params, municipalityId);
  },
};
