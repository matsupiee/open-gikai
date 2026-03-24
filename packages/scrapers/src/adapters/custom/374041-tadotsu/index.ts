/**
 * 多度津町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://www.town.tadotsu.kagawa.jp/choseijoho/tadotsuchogikai/kaigiroku/index.html
 * 自治体コード: 374041
 *
 * 多度津町は年度別 HTML ページから PDF を直接ダウンロードする形式で議事録を公開しており、
 * 専用の検索システムは存在しないためカスタムアダプターとして実装する。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export { parseIndexPage, parseYearPage, detectMeetingName, estimateHeldOn } from "./list";
export { parseStatements, parseSpeaker, classifyKind } from "./detail";

export const adapter: ScraperAdapter = {
  name: "374041",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);

    return meetings.map((m) => ({
      detailParams: {
        pdfUrl: m.pdfUrl,
        title: m.title,
        heldOn: m.heldOn,
        meetingName: m.meetingName,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityId }) {
    const params = detailParams as {
      pdfUrl: string;
      title: string;
      heldOn: string;
      meetingName: string;
    };
    return fetchMeetingData(params, municipalityId);
  },
};
