/**
 * 滑川町議会 会議録 — ScraperAdapter 実装
 *
 * サイト: https://smart.discussvision.net/smart/tenant/namegawa/WebView/rd/council_1.html
 * 自治体コード: 113417
 *
 * DiscussVision Smart システムの REST JSON API を使用して会議録データを取得する。
 * テナント ID: 570
 */

import type { ScraperAdapter, ListRecord } from "../../adapter";
import { fetchMeetingList } from "./list";
import { fetchMeetingData } from "./detail";
import type { NamegawaListRecord } from "./list";

export const adapter: ScraperAdapter = {
  name: "113417",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchMeetingList(year);

    return records.map((r) => ({
      detailParams: {
        councilId: r.councilId,
        scheduleId: r.scheduleId,
        councilLabel: r.councilLabel,
        scheduleLabel: r.scheduleLabel,
        heldOn: r.heldOn,
        councilYear: r.councilYear,
        playlist: r.playlist,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const record = detailParams as unknown as NamegawaListRecord;
    return fetchMeetingData(record, municipalityCode);
  },
};
