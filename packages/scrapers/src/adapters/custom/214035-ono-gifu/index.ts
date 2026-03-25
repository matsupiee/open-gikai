/**
 * 岐阜県大野町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town-ono.jp/category/2-0-0-0-0-0-0-0-0-0.html
 * 自治体コード: 214035
 *
 * 大野町は公式サイトの「議会だより（一般質問）」ページに年度別の PDF を公開している。
 * 専用の会議録検索システムはなく、カスタムアダプターとして実装する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList, type OnoGifuMeeting } from "./list";

export const adapter: ScraperAdapter = {
  name: "214035",

  async fetchList({ year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        meetingType: m.meetingType,
        sourcePageUrl: m.sourcePageUrl,
        heldOn: m.heldOn,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as unknown as OnoGifuMeeting;
    return fetchMeetingData(params, municipalityId);
  },
};
