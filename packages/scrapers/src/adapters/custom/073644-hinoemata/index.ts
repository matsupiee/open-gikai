/**
 * 檜枝岐村議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.vill.hinoemata.lg.jp/
 * 自治体コード: 073644
 *
 * 2026-03-28 時点で、檜枝岐村公式サイトには通常議会の会議録本文や PDF が見当たらない。
 * そのため fetchList は常に空配列を返す。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { fetchMeetingData } from "./detail";
import { fetchMeetingList } from "./list";
import { BASE_PAGE_URL } from "./shared";

export const adapter: ScraperAdapter = {
  name: "073644",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl || BASE_PAGE_URL, year);
    return meetings.map((meeting) => ({ detailParams: meeting }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    return fetchMeetingData(detailParams, municipalityCode);
  },
};
