/**
 * 神山町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.kamiyama.lg.jp/soshiki/gikaijumukyoku/
 * 自治体コード: 363421
 *
 * 神山町議会は会議録（本会議・委員会の議事録）を公開していない。
 * 議会だより（PDF）と一般質問動画（YouTube）のみ公開されており、
 * 会議録本文に相当するコンテンツは存在しないため、
 * fetchList は常に空配列を返す。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";

export const adapter: ScraperAdapter = {
  name: "363421",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl, year);
    return meetings.map((m) => ({ detailParams: m }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    return fetchMeetingData(detailParams, municipalityCode);
  },
};
