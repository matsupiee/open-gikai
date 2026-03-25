/**
 * 河北町議会 DiscussVision Smart — ScraperAdapter 実装
 *
 * サイト: https://smart.discussvision.net/smart/tenant/kahoku/WebView/rd/council_1.html
 * 自治体コード: 063215
 *
 * DiscussVision Smart の JSONP API 経由で会議データを取得する。
 * 会議録テキストは非公開のため、発言サマリー（content）と発言者情報のみ取得する。
 */

import type { ListRecord, ScraperAdapter } from "../../adapter";
import { buildMeetingData } from "./detail";
import type { PlaylistItem } from "./list";
import { fetchCouncilList } from "./list";

export const adapter: ScraperAdapter = {
  name: "063215",

  async fetchList({ year }): Promise<ListRecord[]> {
    const records = await fetchCouncilList(year);

    return records.map((rec) => ({
      detailParams: {
        councilId: rec.councilId,
        councilLabel: rec.councilLabel,
        councilYear: rec.councilYear,
        scheduleId: rec.scheduleId,
        scheduleLabel: rec.scheduleLabel,
        playlist: rec.playlist,
      },
    }));
  },

  async fetchDetail({ detailParams, municipalityCode }) {
    const params = detailParams as {
      councilId: string;
      councilLabel: string;
      councilYear: string;
      scheduleId: string;
      scheduleLabel: string;
      playlist: PlaylistItem[];
    };
    return buildMeetingData(params, municipalityCode);
  },
};
