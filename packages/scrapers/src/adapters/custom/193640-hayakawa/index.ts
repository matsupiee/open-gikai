/**
 * 早川町議会 -- ScraperAdapter 実装
 *
 * サイト: https://www.town.hayakawa.yamanashi.jp/town/assembly/assembly/
 * 自治体コード: 193640
 *
 * 2026-03-27 時点で、早川町公式サイトには本会議・委員会の会議録本文は公開されていない。
 * 「模擬議会」ページに模擬議会の PDF 議事録は存在するが、
 * open-gikai の対象となる通常議会の会議録ではないためスクレイピング対象外とする。
 * そのため fetchList は常に空配列を返す。
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";
import { BASE_PAGE_URL } from "./shared";

export const adapter: ScraperAdapter = {
  name: "193640",

  async fetchList({ baseUrl, year }): Promise<ListRecord[]> {
    const meetings = await fetchMeetingList(baseUrl || BASE_PAGE_URL, year);
    return meetings.map((meeting) => ({ detailParams: meeting }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    return fetchMeetingData(detailParams, municipalityCode);
  },
};
